import { useTheming } from '../../utils/theming-helper';
import * as React from 'react';
const { useState, useEffect } = React;
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Alert,
  Chip,
  Card as MuiCard,
  CardContent,
  Grid,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  FormControlLabel,
  Checkbox,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
} from '@mui/material';
import {
  DirectionsBusiness,
  Warning,
  CheckCircle,
  Error,
  Google,
  CloudDone,
  Security,
  Verified,
  Search,
  Assessment,
} from '@mui/icons-material';
const logoCreatorHub = '/creatorhub-logo-amber.svg';
import PrototypeTesterModal from './PrototypeTesterModal';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
// Import dynamic profession system
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';
import { useExternalData } from '../../services/ExternalDataService';

const inviteSchema = z.object({
  // Business Information
  businessName: z.string().min(2 'Bedriftsnavn må være minst 2 tegn, '),
  orgNumber: z.string().regex(/^\d{9}$/'Organisasjonsnummer må være 9 siffer, '),

  // Contact Details
  contactName: z.string().min(2, 'Kontaktperson må være minst 2 tegn'),
  contactEmail: z.string().email('Ugyldig epostadresse'),
  contactPhone: z.string().min(8, 'Telefonnummer må være minst 8 siffer'),

  // Bot Protection - Honeypot field (should be empty)
  website_url_trap: z.string().max(0'Bot detected').optional().or(z.literal(',')),

  // Professional Information - now uses dynamic profession system
  profession: z.string().min(1'Vennligst velg profesjon'),
  specialization: z.string().optional(),
  teamSize: z.number().min(1'Team størrelse må være minst 1'),
  annualRevenue: z.string().optional(),

  // Business Details
  businessDescription: z.string().min(50'Bedriftsbeskrivelse må være minst 50 tegn'),
  websiteUrl: z.string().url('Ugyldig nettside URL').optional().or(z.literal(',')),
  currentChallenges: z.string().min(20'Beskriv utfordringer (minst 20 tegn)'),
  whyCreatorHub: z.string().min(30'Hvorfor CreatorHub Norge? (minst 30 tegn)'),

  // Google Workspace Integration
  hasGoogleWorkspace: z.boolean(),
  googleWorkspaceEmail: z.string().optional(),

  // Terms acceptance
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'Du må akseptere vilkårene' }),
  acceptGoogleIntegration: z.boolean(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface BusinessVerificationResult {
  success: boolean;
  businessInfo?: {
    displayName: string;
    orgNumber: string;
    address: string;
    businessType: string;
    foundingYear: string;
    employeeCount: string;
    mvaRegistered: boolean;
    owner?: string;
};
}

// Mock data removed - using database connection

interface SpecializedContactModalProps {
  open: boolean;
  onClose: () => void;
  defaultRole?: string
}

export default function SpecializedContactModal({
  open,
  onClose,
  defaultRole,
}: SpecializedContactModalProps) {
  // Dynamic profession system hooks
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const {
    professions,
    loading: professionsLoading,
    error: professionsError,
    getProfessionConfig,
} = useDynamicProfessions();

  const userProfession = user?.profession;
  const professionConfig = getProfessionConfig(userProfession || defaultRole || '');
  
  // External data service for BRREG company verification
  const { getBRREGCompanyData, searchBRREGCompanies } = useExternalData();

  const [currentStep, setCurrentStep] = useState(0);
  const [businessVerification, setBusinessVerification] =
    useState<BusinessVerificationResult | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [isPrototypeTester, setIsPrototypeTester] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [businessInfoConfirmed, setBusinessInfoConfirmed] = useState(false);
  const [showPrototypeTesterModal, setShowPrototypeTesterModal] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);
  const [lastScrollTop, setLastScrollTop] = useState(0);

  // Bot protection - timing check
  const [formStartTime] = useState(Date.now());
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

  // Dynamic profession options based on available professions
  const professionOptions = professions.map((profession) => ({
    value: profession.d,
    label: profession.displayName,
    description: profession.description || `Profesjonell ${profession.displayName.toLowerCase()} tjeneste`,
}));

  // Loading state for UI elements
  if (professionsLoading) {
    return (
      <Dialog open={open} onClose={onClose}>
        <DialogContent>
          <Typography>Laster profesjonsdata...</Typography>
        </DialogContent>
      </Dialog>
    );
}

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isValid },
    reset,
} = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      businessName: '',
      orgNumber: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      profession: defaultRole || userProfession || professions[0]?.id || 'vendor',
      specialization: '',
      teamSize:  1,
      annualRevenue: '',
      businessDescription: '',
      websiteUrl: '',
      currentChallenges: '',
      whyCreatorHub: '',
      hasGoogleWorkspace: false,
      googleWorkspaceEmail: '',
      acceptTerms: false,
      acceptGoogleIntegration: false,
      website_url_trap: '',
  },
    mode: 'onChange' });

  // reCAPTCHA v3 integration
  useEffect(() => {
    if (open && showForm) {
      const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
      if (siteKey && siteKey !== 'placeholder') {
        const script = document.createElement('script');
        script.src = `https: //www.google.com/recaptcha/api.js?render=${siteKy}`;
        script.async = true;
        document.head.appendChild(script);

        return () => {
          try {
            document.head.removeChild(script);
        } catch (e) {
            // Script may already be removed
        }
      };
    }
  }
}, [open, showForm]);

  const orgNumber = watch('orgNumber');
  const hasGoogleWorkspace = watch('hasGoogleWorkspace');
  const profession = watch('profession');

  const [searchSuggestions, setSearchSuggestions] = useState<
    Array<{ name: string; orgNumber: string; businessType: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isManualVerification, setIsManualVerification] = useState(false);

  // Business verification using ExternalDataService
  const verifyBusiness = async (orgNumber: string) => {
    setVerificationLoading(true);
    try {
      const companyData = await getBRREGCompanyData(orgNumber);
      
      const businessVerificationResult: BusinessVerificationResult = {
        success: true,
        businessInfo: {
          displayName: companyData.name,
          orgNumber: companyData.organizationNumber,
          address: `${companyData.businessAddress.adresse}, ${companyData.businessAddress.postnummer} ${companyData.businessAddress.poststed}`,
          businessType: companyData.organizationFormDescription || companyData.organizationForm,
          foundingYear: companyData.registrationDate?.split('-')[0] || 'Ukjent',
          employeeCount: companyData.employees?.toString() || 'Ukjent',
          mvaRegistered: true, // Assume MVA registered for active companies
      }
    };
      
      setBusinessVerification(businessVerificationResult);
      setIsManualVerification(false);
      
      // Update form fields
      const currentBusinessName = getValues('businessName');
      if (!currentBusinessName || currentBusinessName.trim() === '') {
        setValue('businessName', companyData.name);
    }
      
  } catch (error) {
      console.error('Business verification failed:', error);
      setBusinessVerification({
        success: false,
        error: 'Kunne ikke verifisere bedriftsinformasjon' });
  } finally {
      setVerificationLoading(false);
  }
};

  // Business search using ExternalDataService
  const searchBusiness = async (query: string) => {
    try {
      const result = await searchBRREGCompanies({ name: query, limit: 5 });
      const suggestions = result.companies.map(company => ({
        name: company.name,
        orgNumber: company.organizationNumber,
        businessType: company.industry
    }));
      setSearchSuggestions(suggestions);
      setShowSuggestions(true);
  } catch (error) {
      console.error('Business search failed:', error);
      setSearchSuggestions([]);
      setShowSuggestions(false);
  }
};

  // Submit invitation mutation
  const submitInviteMutation = useMutation({
    mutationFn: (data: InviteFormData) => apiRequest('POST', '/api/invites/submit', data),
    onSuccess: () => {
      setCurrentStep(4); // Success step
  },
});

  // Auto-open form when defaultRole is provided (for vendor network, etc.)
  useEffect(() => {
    if (defaultRole && open) {
      setShowForm(true);
      setIsPrototypeTester(false);
      setCurrentStep(0); // Start at first step
      // Set the profession value in the form
      setValue('profession', defaultRole as any);
  }
}, [defaultRole, open, setValue]);

  // Handle manual search trigger
  const handleSearch = () => {
    if (orgNumber && orgNumber.trim().length > 0) {
      setIsManualVerification(true);
      setShowSuggestions(false);
      verifyBusiness(orgNumber.trim());
  }
};

  // Handle search suggestions
  const handleSearchInput = (value: string) => {
    setValue('orgNumber', value);
    // Only reset business verification if the org number changed significantly
    if (businessVerification && businessVerification.businessInfo?.orgNumber !== value) {
      setBusinessVerification(null);
  }
    setIsManualVerification(false);

    // If it's potentially a company name (contains letters), show suggestions
    if (value.length >= 2 && /[a-zA-ZæøåÆØÅ]/.test(value)) {
      searchBusiness(value);
  } else {
      setShowSuggestions(false);
      setSearchSuggestions([]);
  }
};

  // Select suggestion
  const selectSuggestion = (suggestion: {
    name: string;
    orgNumber: string;
    businessType: string;
}) => {
    setIsManualVerification(true);
    setValue('orgNumber', suggestion.orgNumber);
    setValue('businessName', suggestion.name);
    setShowSuggestions(false);
    verifyBusiness(suggestion.orgNumber);
};

  // Auto-verify business when org number is complete (9 digits)
  useEffect(() => {
    if (orgNumber && orgNumber.length === 9 && /^\d{9}$/.test(orgNumber) && !isManualVerification) {
      // Only auto-verify if we don't already have verification for this orgNumber
      if (!businessVerification || businessVerification.businessInfo?.orgNumber !== orgNumber) {
        setShowSuggestions(false);
        verifyBusiness(orgNumber);
    }
  } else if (!orgNumber || orgNumber.length === 0) {
      // Only reset if we truly have no org number
      setBusinessVerification(null);
      setBusinessInfoConfirmed(false);
  }
}, [orgNumber, businessVerification]);

  // Reset confirmation when business verification changes
  useEffect(() => {
    setBusinessInfoConfirmed(false);
}, [businessVerification]);

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 3));
};

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
};

  const onSubmit = async (data: InviteFormData) => {
    // Check if business verification is complete and confirmed
    if (businessVerification?.success && !businessInfoConfirmed) {
      alert('Vennligst bekreft at bedriftsinformasjonen er riktig før du sender inn søknaden.');
      return;
}

    // Bot protection checks
    const timeTaken = Date.now() - formStartTime;
    const minimumTime = 30000; // 30 seconds minimum

    if (timeTaken < minimumTime) {
      alert('Vennligst bruk litt mer tid på å fylle ut skjemaet.');
      return;
  }

    // Check honeypot field
    if (data.website_url_trap && data.website_url_trap.trim() !== '') {
      console.log('Bot detected via honeypot');
      return;
  }

    // Get reCAPTCHA token if available
    let recaptchaToken = null;
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (siteKey && siteKey !== 'placeholder' && (window as any).grecaptcha) {
      try {
        recaptchaToken = await (window as any).grecaptcha.execute(siteKey, {
          action: 'submit_invite' });
    } catch (error) {
        console.error('reCAPTCHA error:', error);
    }
  }

    const submitData = {
      ...data,
      businessVerification,
      timeTaken,
      recaptchaToken,
  };

    submitInviteMutation.mutate(submitData);
};

  const handleClose = () => {
    reset();
    setCurrentStep(0);
    setBusinessVerification(null);
    setBusinessInfoConfirmed(false);
    setIsPrototypeTester(false);
    setShowForm(false);
    setShowPrototypeTesterModal(false);
    setHeaderCompact(false);
    setLastScrollTop(0);
    // Reset profession field specifically
    setValue('profession', 'vendor');
    onClose();
};

  // Mock data removed - using database connection

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      fullScreen={showForm}
      scroll="paper"
      sx={{
        '& .MuiDialog-container': {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center' }, '& .MuiBackdrop-root': {
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)' }}}
      PaperProps={{
        sx: {
          borderRadius: showForm ? 0 : { xs: '12px', sm: '24px' },
          background: 'linear-gradient(145deg, rgba(2, 5, 5,255,255,0.98) 0%, rgba(2, 4, 8,250,252,0.95) 100%)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(25,140,0,0.2)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.15), 0 0 0 1px rgba(2, 5, 5,140,0,0.1), inset 0 1px 0 rgba(2, 5, 5,255,255,0.8)',
          overflow: 'hidden',
          position: 'relative',
          height: showForm ? '100vh' : 'auto',
          maxHeight: showForm ? '100vh' : { xs: '95vh', sm: '90vh' },
          width: showForm ? '100vw' : { xs: '95vw', sm: 'auto' },
          margin: showForm ? 0 : { xs: 1, sm:  2 },
          display: 'flex',
          flexDirection: 'column',
          transform: showForm ? 'none' : undefined, '&::before': {
            content: ', ","',
            position: 'absolute',
            top:  0,
            left:  0,
            right:  0,
            height: '6px',
            background: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 30%, #d97706 70%, #c2710c 100%)',
            zIndex: 2,
        },
      }}}
    >
      {!showForm && (
        <DialogTitle
          sx={{
            background: 'linear-gradient(145deg, rgba(2, 5, 5,140,0,0.03) 0%, rgba(2, 5, 5,248,235,0.08) 50%, rgba(2, 5, 1,146,60,0.02) 100%)',
            color: '#1f2930',
            textAlign: 'center',
            py:  3,
            px:  3,
            position: 'relative',
            borderBottom: '1px solid rgba(25,140,0,0.08)' }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap:  2}}
          >
            <Box
              sx={{
                width: 30,
                height: 10,
                borderRadius: '32px',
                background: 'linear-gradient(145deg, rgba(2, 5, 5,255,255,0.95) 0%, rgba(2, 4, 8,250,252,0.9) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 0 6px rgba(2, 5, 5,140,0,0.2), inset 0 4px 0 rgba(2, 5, 5,255,255,0.8)',
                position: 'relative',
                border: '3px solid rgba(25,140,0,0.3)',
                overflow: 'hidden',
                mb: 2, '&::before': { content: ', ","',
                  position: 'absolute',
                  inset: '-4px',
                  borderRadius: '36px',
                  padding: '4px',
                  background: 'linear-gradient(145deg, rgba(2, 5, 5,140,0,0.7), rgba(2, 3, 3,124,0,0.5), rgba(2, 5, 5,140,0,0.7))',
                  mask: 'linear-gradient(#fff',0 0) content-box, linear-gradient(#fff',0 0)',
                  maskComposite: 'xor',
                  WebkitMaskComposite: 'xor' }}}
            >
              <img
                src={logoCreatorHub}
                alt="CreatorHub Norge Logo"
                style={{
                  width: '320px',
                  height: '96px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 6px 16px rgba(25,140,0,0.4))' }}
              />
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6"
                sx={{ 
                  color: '#ff8c00',
                  fontWeight: 600,
                  mb:  1 }}>
                Få tilgang til Profesjonell Kreativ Platform
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: '#6b7280',
                  maxWidth: '500px',
                  mx: 'auto',
                  lineHeight: 1.6,
                  mb:  3}}
              >
                Eksklusiv invite-only nettverk med full Google Workspace integrasjon,
                <br />
                avanserte kreative verktøy og profesjonell bedriftsvalidering
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  gap:  2,
                  justifyContent: 'center',
                  mt:  2}}
              >
                <Button variant="contained"
                  onClick={() => {
                    setIsPrototypeTester(false);
                    setShowForm(true);
                }}
                  sx={{
                    background: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 100%)',
                    color: 'white',
                    fontWeight: 'bold',
                    px:  3,
                    py: 1.5,
                    borderRadius: '12px',
                    textTransform: 'none',
                    boxShadow: '0 8px 24px rgba(25,140,0,0.3)','&:hover': {
                      background: 'linear-gradient(135deg, #e67c00 0%, #d97706 100%)',
                      boxShadow: '0 12px 32px rgba(25,140,0,0.4)' }}}
                >
                  Søk om Tilgang
                </Button>

                <Button
                  variant="outlined"
                  onClick={() => {
                    setShowPrototypeTesterModal(true);
                }}
                  sx={{
                    border: '2px solid #ff8c00',
                    color: '#ff8c00',
                    fontWeight: 'bold',
                    px:  3,
                    py: 1.5,
                    borderRadius: '12px',
                    textTransform: 'none','&:hover': {
                      backgroundColor: 'rgba(25,140,0,0.05)',
                      border: '2px solid #e67c00',
                      color: '#e67c00' }}}
                >
                  Prototype Tester
                </Button>
              </Box>
            </Box>
          </Box>
        </DialogTitle>
      )}

      {showForm && (
        <>
          {/* Compact header for form mode */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: headerCompact ? 1 : 2,
              borderBottom: '1px solid rgba(25,140,0,0.1)',
              background: 'linear-gradient(145deg, rgba(2, 5, 5,140,0,0.03) 0%, rgba(2, 5, 5,248,235,0.08) 100%)',
              flexShrink:  0,
              transition: 'all 0.3s ease',
              height: headerCompact ? '48px' : '64px',
              overflow: 'hidden' }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: headerCompact ? 1 : 2,
                transition: 'all 0.3s ease' }}
            >
              <img
                src={logoCreatorHub}
                alt="CreatorHub Norge"
                style={{
                  height: headerCompact ? '24px' : '32px',
                  objectFit: 'contain',
                  transition: 'all 0.3s ease' }}
              />
              {!headerCompact && (
                <Typography variant="h6"
                  sx={{ 
                    color: '#ff8c00',
                    fontWeight: 600,
                    transition: 'all 0.3s ease'  }}>
                  Søk om Tilgang
                </Typography>
              )}
            </Box>
            <Button onClick={handleClose} sx={{ color: '#ff8c00' }}>
              ✕
            </Button>
          </Box>

          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogContent
              onScroll={(e) => {
                const scrollTop = e.currentTarget.scrollTop;

                // Mer sensitiv scroll-deteksjon
                if (scrollTop > 20 && !headerCompact) {
                  setHeaderCompact(true);
              } else if (scrollTop <= 10 && headerCompact) {
                  setHeaderCompact(false);
              }

                setLastScrollTop(scrollTop);
            }}
              sx={{
                p: { xs: 2, sm:  3 },
                flex:  1,
                overflowY: 'auto','&::-webkit-scrollbar': {
                  width: '8px' }, '&::-webkit-scrollbar-track': {
                  background: 'rgba(0,0,0,0.05)',
                  borderRadius: '4px' }, '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(25,140,0,0.3)',
                  borderRadius: '4px','&:hover': {
                    background: 'rgba(25,140,0,0.5)' },
              }}}
            >
              {isPrototypeTester && (
                <Box
                  sx={{
                    mb:  3,
                    p:  2,
                    backgroundColor: 'rgba(9, 130, 246, 0.1)',
                    borderRadius: '12px',
                    border: '1px solid rgba(9, 130, 246, 0.2)' }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      color: '#1e40af',
                      fontWeight: 600,
                      textAlign: 'center' }}
                  >
                    📋 Prototype Tester Modus
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#374150',
                      textAlign: 'center',
                      mt:  1}}
                  >
                    Du registrerer deg som prototype tester for å evaluere plattformen
                  </Typography>
                </Box>
              )}

              <Stepper
                activeStep={currentStep}
                orientation="horizontal"
                sx={{
                  mb: { xs: 2, sm:  4 }, '& .MuiStepLabel-root .Mui-completed': {
                    color: '#ff8c00' }, '& .MuiStepLabel-root .Mui-active': {
                    color: '#ff8c00' }, '& .MuiStepLabel-labelContainer': {
                    , '& .MuiStepLabel-label': {
                      fontSize: { xs: '0.8rem', sm: '0.875rem' },
                      color: '#6b7280','&.Mui-active': {
                        color: '#ff8c00',
                        fontWeight: 60
                    }, '&.Mui-completed': {
                        color: '#10b980',
                        fontWeight: 5,
                    },
                  },
                }, '& .MuiStepIcon-root': {
                    color: '#e5e7eb','&.Mui-active': {
                      color: '#ff8c00' }, '&.Mui-completed': {
                      color: '#10b980' },
                }}}
              >
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
              {/* Step 1: Business Information , *, /}
              {currentStep === 0 && (
                <Box sx={{ px: { xs: 2, sm:  4, md:  6 }, py: { xs: 2, sm:  4 } }}>
                  <Box
                    sx={{
                      textAlign: 'center',
                      mb: { xs: 2, sm:  4 },
                      pb: { xs: 2, sm:  3 },
                      borderBottom: '1px solid rgba(25,140,0,0.1)' }}
                  >
                    <Typography variant="h5"
                      sx={{ 
                        color: '#1f2930',
                        fontWeight: 'bold',
                        mb:  1 }}>
                      Bedriftsinformasjon
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#6b7280',
                        maxWidth: '400px',
                        mx: 'auto' }}
                    >
                      Vi validerer automatisk bedriftsinformasjon via BRREG.no og Proff.no
                    </Typography>
                  </Box>

                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <Box sx={{ position: 'relative' }}>
                        <Controller
                          name="orgNumber"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              fullWidth
                              label="Organisasjonsnummer eller Bedriftsnavn"
                              placeholder="123456789 eller søk etter bedriftsnavn"
                              error={!!errors.orgNumber}
                              helperText={
                                errors.orgNumber?.message ||
                                'Du kan søke med organisasjonsnummer eller bedriftsnavn'
                            }
                              onChange={(e) => handleSearchInput(e.target.value)}
                              InputProps={{
                                endAdornment: (
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap:  1}}
                                  >
                                    {verificationLoading && <CircularProgress size={20} />}
                                    <Button
                                      onClick={handleSearch}
                                      size="small"
                                      variant="outlined"
                                      disabled={!orgNumber || verificationLoading}
                                      sx={{
                                        minWidth: 'auto',
                                        px:  2,
                                        py:  1,
                                        fontSize: '0.875rem',
                                        border: '1px solid #ff8c00',
                                        color: '#ff8c00','&:hover': {
                                          backgroundColor: 'rgba(25,140,0,0.1)',
                                          borderColor: '#e67c00' }}}
                                    >
                                      Søk
                                    </Button>
                                  </Box>
                                )}}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: 'rgba(25,255,255,0.7)',
                                  backdropFilter: 'blur(10px)',
                                  borderRadius: '12px',
                                  border: '1px solid rgba(25,140,0,0.2)',
                                  transition: 'all 0.3s ease','&:hover': {
                                    backgroundColor: 'rgba(25,255,255,0.8)',
                                    borderColor: 'rgba(25,140,0,0.3)' }, '&.Mui-focused': {
                                    backgroundColor: 'rgba(25,255,255,0.9)',
                                    borderColor: '#ff8c00',
                                    boxShadow: '0 0 0 3px rgba(25,140,0,0.1)' },
                              }}}
                            />
                          )}
                        />

                        {/* Search suggestions dropdown */}
                        {showSuggestions && searchSuggestions.length > 0 && (
                          <Paper
                            sx={{
                              position: 'absolute',
                              top: '100%',
                              left:  0,
                              right:  0,
                              zIndex: 10,
                              mt:  1,
                              maxHeight: '200px',
                              overflowY: 'auto',
                              border: '1px solid rgba(25,140,0,0.2)',
                              borderRadius: '12px',
                              backdropFilter: 'blur(20px)',
                              background: 'rgba(25,255,255,0.95)' }}
                           sx={theming.getThemedCardSx()}>
                            <List dense>
                              {searchSuggestions.map((suggestion, index) => (
                                <ListItem
                                  key={index}
                                  button
                                  onClick={() => selectSuggestion(suggestion)}
                                  sx={{
                                    '&:hover': {
                                      backgroundColor: 'rgba(25,140,0,0.1)' }}}
                                >
                                  <ListItemText
                                    primary={suggestion.name}
                                    secondary={`${suggestion.orgNumber} • ${suggestion.businessType}`}
                                    primaryTypographyProps={{
                                      fontSize: '0.9rem',
                                      fontWeight: 60
                                      color: '#1f2930' }}
                                    secondaryTypographyProps={{
                                      fontSize: '0.8rem',
                                      color: '#6b7280' }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Paper>
                        )}
                      </Box>
                    </Grid>

                    <Grid item xs={12}>
                      <Controller
                        name="businessName"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Bedriftsnavn"
                            error={!!errors.businessName}
                            helperText={errors.businessName?.message}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(25,255,255,0.7)',
                                backdropFilter: 'blur(10px)',
                                borderRadius: '12px',
                                border: '1px solid rgba(25,140,0,0.2)',
                                transition: 'all 0.3s ease','&:hover': {
                                  backgroundColor: 'rgba(25,255,255,0.8)',
                                  borderColor: 'rgba(25,140,0,0.3)',
                                  transform: 'translateY(-1px)',
                                  boxShadow: '0 4px 12px rgba(25,140,0,0.15)' }, '&.Mui-focused': {
                                  backgroundColor: 'rgba(25,255,255,0.9)',
                                  borderColor: '#ff8c00',
                                  boxShadow: '0 0 0 3px rgba(25,140,0,0.1)' },
                            }, '& .MuiInputLabel-root': {
                                color: '#6b7280','&.Mui-focused': {
                                  color: '#ff8c00' },
                            }}}
                          />
                        )}
                      />
                    </Grid>

                    {/* Business Verification Results */}
                    {businessVerification && (
                      <Grid item xs={12}>
                        <MuiCard
                          sx={{
                            backgroundColor: businessVerification.success
                              ? 'rgba(6, 175, 80, 0.1)'
                              : 'rgba(2, 4, 4, 67, 54, 0.1)',
                            border: businessVerification.success
                              ? '1px solid rgba(6, 175, 80, 0.3)'
                              : '1px solid rgba(2, 4, 4, 67, 54, 0.3)' }}
                        >
                          <CardContent sx={theming.getThemedCardSx()}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                mb:  2}}
                            >
                              {businessVerification.success ? (
                                <CheckCircle sx={{ color: 'success.main', mr:  1 }} />
                              ) : (
                                <Error sx={{ color: 'error.main', mr:  1 }} />
                              )}
                              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Bedriftsverifikasjon</Typography>
                            </Box>

                            {businessVerification.success && businessVerification.businessInfo && (
                              <Box>
                                <Typography variant="body2" color="textSecondary" sx={{ mb:  2 }}>
                                  ✅ Bedriften er verifisert i Brønnøysundregistrene
                                </Typography>

                                <Box sx={{ mb:  2 }}>
                                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 600}>
                                    Bedriftsinformasjon: </Typography>
                                  <Typography
                                    variant="body2"
                                    color="textSecondary"
                                    sx={{ mb: 0.5}}
                                  >
                                    <strong>Navn: </strong>{''}
                                    {businessVerification.businessInfo.displayName}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="textSecondary"
                                    sx={{ mb: 0.5}}
                                  >
                                    <strong>Org.nr: </strong>{''}
                                    {businessVerification.businessInfo.orgNumber}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="textSecondary"
                                    sx={{ mb: 0.5}}
                                  >
                                    <strong>Organisasjonsform: </strong>{''}
                                    {businessVerification.businessInfo.businessType}
                                  </Typography>
                                  {businessVerification.businessInfo.owner && (
                                    <Typography
                                      variant="body2"
                                      color="textSecondary"
                                      sx={{ mb: 0.5}}
                                    >
                                      <strong>Innehaver: </strong>{''}
                                      {businessVerification.businessInfo.owner}
                                    </Typography>
                                  )}
                                  <Typography
                                    variant="body2"
                                    color="textSecondary"
                                    sx={{ mb: 0.5}}
                                  >
                                    <strong>Adresse: </strong>{', '}
                                    {businessVerification.businessInfo.address}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="textSecondary"
                                    sx={{ mb: 0.5}}
                                  >
                                    <strong>Grunnlagt: </strong>{', '}
                                    {businessVerification.businessInfo.foundingYear}
                                  </Typography>
                                  <Typography variant="body2" color="textSecondary">
                                    <strong>Ansatte: </strong>{', '}
                                    {businessVerification.businessInfo.employeeCount}
                                  </Typography>
                                </Box>

                                <Box sx={{ mt:  2 }}>
                                  <Button
                                    variant={businessInfoConfirmed ? 'contained' : 'outlined'}
                                    color={businessInfoConfirmed ? 'success' : 'primary'}
                                    onClick={() => setBusinessInfoConfirmed(!businessInfoConfirmed)}
                                    startIcon={
                                      businessInfoConfirmed ? theming.getThemedIcon('checkCircle') : <Verified />
                                  }
                                    sx={{
                                      borderRadius: '8px',
                                      textTransform: 'none',
                                      fontWeight: 60
                                     , px:  3,
                                      py:  1,
                                      ...(businessInfoConfirmed
                                        ? {
                                            backgroundColor: '#4caf50','&:hover': {
                                              backgroundColor: '#45a040' },
                                        }
                                        : {
                                            borderColor: '#ff8c00',
                                            color: '#ff8c00','&:hover': {
                                              backgroundColor: 'rgba(25,140,0,0.1)',
                                              borderColor: '#ff8c00' },
                                        })}}
                                  >
                                    {businessInfoConfirmed
                                      ? 'Informasjonen er bekreftet'
                                      : 'Kan du bekrefte at informasjonen er riktig?'}
                                  </Button>
                                </Box>
                              </Box>
                            )}
                          </CardContent>
                        </MuiCard>
                      </Grid>
                    )}

                    <Grid item xs={12}>
                      <Controller
                        name="profession"
                        control={control}
                        render={({ field }) => (
                          <FormControl
                            fullWidth
                            error={!!errors.profession}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(25,255,255,0.8)',
                                backdropFilter: 'blur(10px)',
                                borderRadius: '12px',
                                border: '2px solid rgba(25,140,0,0.3)',
                                minHeight: '60px',
                                fontSize: '1.1rem',
                                transition: 'all 0.3s ease','&:hover': {
                                  backgroundColor: 'rgba(25,255,255,0.9)',
                                  borderColor: 'rgba(25,140,0,0.5)',
                                  transform: 'translateY(-2px)',
                                  boxShadow: '0 8px 25px rgba(25,140,0,0.2)' }, '&.Mui-focused': {
                                  backgroundColor: 'rgba(25,255,255,0.95)',
                                  borderColor: '#ff8c00',
                                  boxShadow: '0 0 0 4px rgba(25,140,0,0.15)',
                                  transform: 'translateY(-2px)' },
                            }, '& .MuiInputLabel-root': {
                                fontSize: '1.2rem',
                                fontWeight: 7,
                                color: '#1f2930',
                                backgroundColor: 'rgba(25,255,255,0.9)',
                                padding: '0 8px',
                                borderRadius: '6px','&.Mui-focused': {
                                  color: '#ff8c00',
                                  fontSize: '1.2rem' }, '&.Mui-error': {
                                  color: '#dc2620' },
                            }, '& .MuiSelect-select': {
                                fontSize: '1.1rem',
                                fontWeight: 60
                                color: '#1f2930',
                                padding: '18px 16px',
                                minHeight: '20px !important' }}}
                          >
                            <InputLabel
                              sx={{
                                fontSize: '1.2rem',
                                fontWeight: 7,
                                backgroundColor: 'rgba(25,255,255,0.9)',
                                padding: '0 8px',
                                borderRadius: '6px' }}
                            >
                              Velg din profesjon *
                            </InputLabel>
                            <Select
                              {...field}
                              label="Velg din profesjon *"
                              MenuProps={{
                                PaperProps: {
                                  sx: {
                                    borderRadius: '16px',
                                    border: '2px solid rgba(25,140,0,0.3)',
                                    backdropFilter: 'blur(20px)',
                                    background: 'rgba(25,255,255,0.95)',
                                    maxHeight: '400px',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.15)','& .MuiMenuItem-root': {
                                      fontSize: '1.1rem',
                                      fontWeight: 60
                                      padding: '16px 20px',
                                      minHeight: '60px',
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      color: '#1f2930',
                                      borderRadius: '8px',
                                      margin: '4px 8px',
                                      transition: 'all 0.2s ease','&:hover': {
                                        backgroundColor: 'rgba(25,140,0,0.15)',
                                        color: '#1f2930',
                                        transform: 'translateX(4px, )' }, '&.Mui-selected': {
                                        backgroundColor: 'rgba(25,140,0,0.25)',
                                        color: '#1f2930',
                                        fontWeight: 7,
                                        borderLeft: '4px solid #ff8c00','&:hover': {
                                          backgroundColor: 'rgba(25,140,0,0.3)' },
                                    },
                                  },
                                },
                              }}}
                            >
                              {professionOptions.map((option) => (
                                <MenuItem
                                  key={option.value}
                                  value={option.value}
                                  sx={{
                                    display: 'block',
                                    textAlign: 'left' }}
                                >
                                  <Typography
                                    variant="body1"
                                    sx={{
                                      fontSize: '1.1rem',
                                      fontWeight: 7,
                                      color: '#1f2930',
                                      mb: 0.5,
                                      lineHeight: 1.3}}
                                  >
                                    {option.label}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      color: '#6b7280',
                                      fontSize: '0.95rem',
                                      fontWeight: 5,
                                      lineHeight: 1.4,
                                      opacity: 0.8}}
                                  >
                                    {option.description}
                                  </Typography>
                                </MenuItem>
                              ))}
                            </Select>
                            {errors.profession && (
                              <Typography
                                variant="body2"
                                sx={{
                                  color: '#dc2620',
                                  mt:  1,
                                  ml:  2,
                                  fontSize: '1rem',
                                  fontWeight: 60
                                  backgroundColor: 'rgba(20, 38, 38, 0.1)',
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(20, 38, 38, 0.3)' }}
                              >
                                {errors.profession.message}
                              </Typography>
                            )}
                          </FormControl>
                        )}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Controller
                        name="businessDescription"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            multiline
                            rows={4}
                            label="Bedriftsbeskrivelse"
                            placeholder="Beskriv virksomheten din, spesialiseringer og tjenester..."
                            error={!!errors.businessDescription}
                            helperText={errors.businessDescription?.message}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(25,255,255,0.05)' }}}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Step 2: Contact Details , *, /}
              {currentStep === 1 && (
                <Box>
                  <Typography variant="h6" sx={{  mb:  3, color: '#ff6b35'  }}>
                    Kontaktinformasjon
                  </Typography>

                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="contactName"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Kontaktperson"
                            error={!!errors.contactName}
                            helperText={errors.contactName?.message}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(25,255,255,0.05)' }}}
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Controller
                        name="contactEmail"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="E-post"
                            type="email"
                            error={!!errors.contactEmail}
                            helperText={errors.contactEmail?.message}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(25,255,255,0.05)' }}}
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Controller
                        name="contactPhone"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Telefon"
                            error={!!errors.contactPhone}
                            helperText={errors.contactPhone?.message}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(25,255,255,0.05)' }}}
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Controller
                        name="teamSize"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Team størrelse"
                            type="number"
                            inputProps={{ min: 1, max: 100}}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(25,255,255,0.05)' }}}
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Controller
                        name="currentChallenges"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            multiline
                            rows={3}
                            label="Nåværende utfordringer"
                            placeholder="Hvilke utfordringer har dere i dag som CreatorHub Norge kan løse?"
                            error={!!errors.currentChallenges}
                            helperText={errors.currentChallenges?.message}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(25,255,255,0.05)' }}}
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Controller
                        name="whyCreatorHub"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            multiline
                            rows={3}
                            label="Hvorfor CreatorHub Norge?"
                            placeholder="Hvorfor er CreatorHub Norge den rette løsningen for deres virksomhet?"
                            error={!!errors.whyCreatorHub}
                            helperText={errors.whyCreatorHub?.message}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(25,255,255,0.05)' }}}
                          />
                        )}
                      />
                    </Grid>

                    {/* Honeypot field - hidden from users, but visible to bots */}
                    <Grid item xs={12} sx={{ display: 'none' }}>
                      <Controller
                        name="website_url_trap"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Website URL (Do not fill)"
                            tabIndex={-1}
                            autoComplete="off"
                            sx={{
                              position: 'absolute',
                              left: '-9999px',
                              opacity:  0}}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Step 3: Google Workspace Integration , *, /}
              {currentStep === 2 && (
                <Box>
                  <Typography variant="h6" sx={{  mb:  3, color: '#ff6b35'  }}>
                    Google Workspace Integrasjon
                  </Typography>

                  <Alert
                    severity="info"
                    sx={{ mb:  3, backgroundColor: 'rgba(3, 150, 243, 0.1)' }}
                    icon={<Google />}
                  >
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mb:  1 }}>
                      CreatorHub Norge er fullt integrert med Google Workspace
                    </Typography>
                    <Typography variant="body2">
                      Vår plattform gir sømløs tilgang til Google Drive, Docs, Calendar, Meet og
                      Photos for optimal workflow. Google Workspace integrasjonen inkluderer
                      automatisk backup, team-samarbeid og professional business-verktøy.
                    </Typography>
                  </Alert>

                  <Paper
                    sx={{
                      p:  3,
                      backgroundColor: 'rgba(25,255,255,0.05)',
                      mb:  3}}
                   sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                      <CloudDone sx={{ color: '#4285f0', mr:  2 }} />
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>Google Workspace Fordeler</Typography>
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <List dense>
                          <ListItem>
                            <ListItemIcon>
                              <Security sx={{ color: '#34a853' }} />
                            </ListItemIcon>
                            <ListItemText primary="Automatisk backup til Google Drive" />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <Verified sx={{ color: '#4285f4' }} />
                            </ListItemIcon>
                            <ListItemText primary="Real-time team samarbeid" />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <Business sx={{ color: '#ea4335' }} />
                            </ListItemIcon>
                            <ListItemText primary="Professional email-system" />
                          </ListItem>
                        </List>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <List dense>
                          <ListItem>
                            <ListItemIcon>
                              <CloudDone sx={{ color: '#fbbc04' }} />
                            </ListItemIcon>
                            <ListItemText primary="Sømløs kalender-integrasjon" />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <Google sx={{ color: '#4285f4' }} />
                            </ListItemIcon>
                            <ListItemText primary="Google Meet for klient-møter" />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <Assessment sx={{ color: '#34a853' }} />
                            </ListItemIcon>
                            <ListItemText primary="Google Analytics integrasjon" />
                          </ListItem>
                        </List>
                      </Grid>
                    </Grid>
                  </Paper>

                  <Controller
                    name="hasGoogleWorkspace"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Checkbox {...field} checked={field.value} sx={{ color: '#4285f4' }} />
                      }
                        label="Vi har allerede Google Workspace"
                        sx={{ mb:  2 }}
                      />
                    )}
                  />

                  {hasGoogleWorkspace && (
                    <Controller
                      name="googleWorkspaceEmail"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Google Workspace E-post"
                          placeholder="admin@yourbusiness.com"
                          helperText="E-posten til Google Workspace administratoren"
                          sx={{
                            mb: 2, '& .MuiOutlinedInput-root': {
                              backgroundColor: 'rgba(25,255,255,0.05)' }}}
                        />
                      )}
                    />
                  )}

                  <Controller
                    name="acceptGoogleIntegration"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Checkbox {...field} checked={field.value} sx={{ color: '#ff6b35' }} />
                      }
                        label="Jeg godtar Google Workspace integrasjon og deling av business-data for optimal platform-funksjonalitet"
                      />
                    )}
                  />
                </Box>
              )}

              {/* Step 4: Confirmation , *, /}
              {currentStep === 3 && (
                <Box>
                  <Typography variant="h6" sx={{  mb:  3, color: '#ff6b35'  }}>
                    Bekreft søknad
                  </Typography>

                  <Alert
                    severity="warning"
                    sx={{ mb:  3, backgroundColor: 'rgba(25, 1520.1)' }}
                  >
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mb:  1 }}>
                      Invite-Only Plattform
                    </Typography>
                    <Typography variant="body2">
                      CreatorHub Norge er en eksklusiv plattform. Vi gjennomgår alle søknader nøye
                      før vi sender invitasjon. Du vil motta svar innen 3-5 virkedager.
                    </Typography>
                  </Alert>

                  <Controller
                    name="acceptTerms"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Checkbox
                            {...field}
                            checked={field.value}
                            required
                            sx={{ color: '#ff6b35' }}
                          />
                      }
                        label={
                          <Typography variant="body2">
                            Jeg aksepterer{' '}
                            <Button
                              variant="text"
                              size="small"
                              sx={{ p: 0, textDecoration: 'underline' }}
                            >
                              vilkår og betingelser
                            </Button>{', '}
                            og{''}
                            <Button
                              variant="text"
                              size="small"
                              sx={{ p: 0, textDecoration: 'underline' }}
                            >
                              personvernregler
                            </Button>
                          </Typography>
                      }
                      />
                    )}
                  />
                  {errors.acceptTerms && (
                    <Typography color="error" variant="body2" sx={{ mt:  1 }}>
                      {errors.acceptTerms.message}
                    </Typography>
                  )}
                </Box>
              )}

              {/* Success Step */}
              {currentStep === 4 && (
                <Box sx={{ textAlign: 'center', py:  4 }}>
                  <CheckCircle sx={{ fontSize:  80, color: 'success.main', mb:  2 }} />
                  <Typography variant="h4" sx={{  mb:  2  }}>
                    Søknad sendt!
                  </Typography>
                  <Typography variant="body1" sx={{ mb:  3 }}>
                    Takk for din interesse i CreatorHub Norge. Vi gjennomgår søknaden din og sender
                    svar innen 3-5 virkedager.
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Du vil motta en e-post med videre instruksjoner hvis søknaden blir godkjent.
                  </Typography>
                </Box>
              )}
            </DialogContent>

            {/* DialogActions flyttet utenfor DialogContent */}
            {currentStep < 4 && (
              <DialogActions
                sx={{
                  justifyContent: 'space-between',
                  p: { xs: 2, sm:  3 },
                  background: 'linear-gradient(145deg, rgba(2, 5, 5,140,0,0.02) 0%, rgba(2, 5, 5,248,235,0.05) 100%)',
                  borderTop: '1px solid rgba(25,140,0,0.08)',
                  flexShrink:  0,
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: { xs: 2, sm:  0 }}}
              >
                <Button
                  onClick={currentStep === 0 ? handleClose : handleBack}
                  variant="outlined"
                  size="large"
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                    border: '2px solid rgba(17,114,128,0.3)',
                    color: '#6b7280',
                    borderRadius: '12px',
                    px: { xs: 3, sm:  4 },
                    py: 1.5,
                    fontWeight: 'bold',
                    textTransform: 'none',
                    minHeight: '48px','&:hover': {
                      border: '2px solid rgba(17,114,128,0.5)',
                      backgroundColor: 'rgba(17,114,128,0.05)' }}}
                >
                  {currentStep === 0 ? 'Avbryt' : 'Tilbake'}
                </Button>

                <Box
                  sx={{
                    display: 'flex',
                    gap:  2,
                    width: { xs: '100%', sm: 'auto' }}}
                >
                  {currentStep < 3 && !(defaultRole === 'vendor' && currentStep >= 2) && (
                    <Button onClick={handleNext}
                      variant="contained"
                      size="large"
                      sx={{
                        width: { xs: '100%', sm: 'auto' },
                        background: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 50%, #d97706 100%)',
                        borderRadius: '12px',
                        px: { xs: 3, sm:  4 },
                        py: 1.5,
                        minHeight: '48px',
                        fontWeight: 'bold',
                        textTransform: 'none',
                        boxShadow: '0 8px 20px rgba(25,140,0,0.3)',
                        transition: 'all 0.3s ease','&:hover': {
                          background: 'linear-gradient(135deg, #e67c00 0%, #d97706 50%, #c2710c 100%)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 12px 28px rgba(25,140,0,0.4)' }, '&:disabled': {
                          background: 'rgba(17,114,128,0.2)',
                          color: 'rgba(17,114,128,0.5)',
                          boxShadow: 'none' }}}
                      disabled={
                        (currentStep === 0 && (!businessVerification?.success || !profession)) ||
                        (currentStep === 1 &&
                          Object.keys(errors).some((key) = sx={theming.getThemedButtonSx()}>
                            [
                              'contactName', 'contactEmail', 'contactPhone', 'currentChallenges','whyCreatorHub',
                            ].includes(key),
                          ))
                    }
                    >
                      Neste Steg
                    </Button>
                  )}

                  {(currentStep === 3 || (defaultRole === 'vendor' && currentStep >= 2)) && (
                    <Button type="submit"
                      variant="contained"
                      size="large"
                      disabled={!isValid || submitInviteMutation.isPending}
                      sx={{
                        width: { xs: '100%', sm: 'auto' },
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                        borderRadius: '12px',
                        px: { xs: 3, sm:  4 },
                        py: 1.5,
                        fontWeight: 'bold',
                        textTransform: 'none',
                        boxShadow: '0 8px 20px rgba(6,185,129,0.3)',
                        transition: 'all 0.3s ease','&:hover': {
                          background: 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 12px 28px rgba(6,185,129,0.4)' }, '&:disabled': {
                          background: 'rgba(17,114,128,0.2)',
                          color: 'rgba(17,114,128,0.5)',
                          boxShadow: 'none' }}}
                     sx={theming.getThemedButtonSx()}>
                      {submitInviteMutation.isPending ? (
                        <CircularProgress size={20} />
                      ) : (
                        '🚀 Send Søknad'
                      )}
                    </Button>
                  )}
                </Box>
              </DialogActions>
            )}
          </form>
        </>
      )}

      {currentStep === 4 && (
        <DialogActions
          sx={{
            justifyContent: 'center',
            p:  4,
            background: 'linear-gradient(145deg, rgba(16,185,129,0.02) 0%, rgba(2, 3, 6,253,245,0.05) 100%)',
            borderTop: '1px solid rgba(6,185,129,0.1)' }}
        >
          <Button onClick={handleClose}
            variant="contained"
            size="large"
            sx={{
              background: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 50%, #d97706 100%)',
              borderRadius: '12px',
              px:  6,
              py:  2,
              fontWeight: 'bold',
              textTransform: 'none',
              fontSize: '16px',
              boxShadow: '0 8px 20px rgba(25,140,0,0.3)',
              transition: 'all 0.3s ease', '&:hover': {
                background: 'linear-gradient(135deg, #e67c00 0%, #d97706 50%, #c2710c 100%)',
                transform: 'translateY(-2px)',
                boxShadow:'0 12px 28px rgba(25,140,0,0.4)' }}}
           sx={theming.getThemedButtonSx()}>
            Ferdig
          </Button>
        </DialogActions>
      )}

      <PrototypeTesterModal
        open={showPrototypeTesterModal}
        onClose={() => setShowPrototypeTesterModal(false)}
      />
    </Dialog>
  );
}
