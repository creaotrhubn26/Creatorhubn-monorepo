import React, { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from '@/hooks/useAuth';
import { useTheming } from '../utils/theming-helper';
import {
  Box,
  TextField,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  CircularProgress,
  Autocomplete,
  InputAdornment,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Slider,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon,
  Science as ScienceIcon,
} from '@mui/icons-material';
import { apiRequest } from "@/lib/queryClient";
// import { debounce } from "lodash"; // Removed to avoid type errors
// Using inline debounce instead
import { useExternalData } from '../services/ExternalDataService';
import { PlanFeaturePreview } from './subscription/PlanFeaturePreview';

interface EnterprisePricingConfig {
  basePrice: number;
  basePriceAnnual: number;
  pricePerUser: number;
  pricePerUserAnnual: number;
  basePriceInclMva: number;
  basePriceAnnualInclMva: number;
  pricePerUserInclMva: number;
  pricePerUserAnnualInclMva: number;
  mvaRate: number;
  mvaPercent: number;
  includedUsers: number;
  volumeDiscounts: Array<{ minUsers: number; discount: number }>;
  currency: string;
}

interface InviteRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess?: () => void;
  onSuccess?: () => void;
  onCancel?: () => void;
  selectedRole?: string;
  selectedPlan?: any;
  source?: string;
}

interface InviteRequestData {
  email: string;
  firstName: string;
  lastName: string;
  profession: string;
  companyName: string;
  organizationNumber: string;
  businessAddress?: string;
  phoneNumber?: string;
  website?: string;
  message?: string
}

interface BrregCompany {
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform: {
    kode: string;
    beskrivelse: string;
};
  adresse?: {
    adresselinje1?: string;
    postnummer?: string;
    poststed?: string;
};
  forretningsadresse?: {
    adresse?: string;
    postnummer?: string;
    poststed?: string;
};
  beliggenhetsadresse?: {
    adresse?: string;
    postnummer?: string;
    poststed?: string;
  };
}

function normalizeNorwegianOrganizationNumber(value: string) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 9);
}

function isValidNorwegianOrganizationNumber(value: string) {
  if (!/^[0-9]{9}$/.test(value)) return false;
  const digits = value.split("").map((digit) => Number(digit));
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce(
    (total, weight, index) => total + weight * digits[index],
    0,
  );
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return digits[8] === 0;
  if (remainder === 10) return false;
  return digits[8] === remainder;
}

export function InviteRequestForm({
  isOpen,
  onClose,
  onSubmitSuccess,
  onSuccess,
  onCancel,
  selectedRole,
  selectedPlan,
  source = "landing",
}: InviteRequestFormProps) {
  const [formData, setFormData] = useState<InviteRequestData>({
    email: "",
    firstName: "",
    lastName: "",
    profession: selectedRole ||"",
    companyName: "",
    organizationNumber: "",
    businessAddress: "",
    phoneNumber: "",
    website: "",
    message: "",
  });

  // Slice 9X.55 — Når profession='prototype_tester' spør vi i tillegg om
  // hvilken faktisk profesjon søkeren har, slik at vi får kartlegging på
  // tvers av tester-pool-en (fotograf, videograf, osv).
  const [testerProfession, setTesterProfession] = useState<string>('');
  // Slice 9X.56 — Søker kan be om team-test (1-5 personer). Master får
  // tilgang etter godkjenning; inviterer resten selv fra dashboard.
  // NB: navngitt 'testerTeamSize' for å unngå kollisjon med eksisterende
  // 'teamSize' lenger ned (brukt for Enterprise-pricing-kalkulator).
  const [isTesterTeamApplication, setIsTesterTeamApplication] = useState<boolean>(false);
  const [testerTeamSize, setTesterTeamSize] = useState<number>(2);

  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Multi-step form state
  const [activeStep, setActiveStep] = useState(0);

  // Enterprise team size state (only for enterprise plans)
  const [teamSize, setTeamSize] = useState(5);

  // Check if this is an enterprise plan
  const isEnterprisePlan = selectedPlan?.name?.toLowerCase().includes('enterprise, ') ||
                           selectedPlan?.id?.toLowerCase().includes('enterprise,') ||
                           selectedPlan?.tier === 'enterprise';

  // Steps for the form - enterprise has extra step
  const steps = isEnterprisePlan
    ? ['Personlig info','Bedriftinfo','Team & Prising','Oppsummering']
    : ['Personlig info','Bedriftinfo','Oppsummering'];

  // Fetch enterprise pricing configuration
  const { data: pricingConfigData } = useQuery({
    queryKey: ['enterprise-pricing-config,'],
    queryFn: async () => {
      const response = await apiRequest('/api/enterprise/pricing/config');
      return response.data as EnterprisePricingConfig;
    },
    staleTime: 5 * 60 * 1000,
    enabled: isEnterprisePlan,
  });

  const pricingConfig = pricingConfigData || {
    basePrice: 1599,
    basePriceAnnual: 15990,
    pricePerUser: 349,
    pricePerUserAnnual: 3490,
    basePriceInclMva: 1999,
    basePriceAnnualInclMva: 19988,
    pricePerUserInclMva: 436,
    pricePerUserAnnualInclMva: 4363,
    mvaRate: 0.25,
    mvaPercent: 25,
    includedUsers: 5,
    volumeDiscounts: [
      { minUsers: 10, discount: 5 },
      { minUsers: 25, discount: 12 },
      { minUsers: 50, discount: 18 },
      { minUsers: 100, discount: 25 },
    ],
    currency: 'NOK'
  };

  // Calculate enterprise pricing
  const calculateEnterprisePrice = () => {
    const extraUsers = Math.max(0, teamSize - pricingConfig.includedUsers);
    const baseMonthlyExMva = pricingConfig.basePrice + (extraUsers * pricingConfig.pricePerUser);

    const applicableDiscount = pricingConfig.volumeDiscounts
      .filter(d => teamSize >= d.minUsers)
      .sort((a, b) => b.minUsers - a.minUsers)[0];

    const discountPercent = applicableDiscount?.discount || 0;
    const monthlyExMva = baseMonthlyExMva * (1 - discountPercent / 100);
    const mvaRate = pricingConfig.mvaRate || 0.25;
    const mvaAmount = monthlyExMva * mvaRate;
    const monthlyInclMva = monthlyExMva + mvaAmount;

    return {
      monthlyExMva: Math.round(monthlyExMva),
      mvaAmount: Math.round(mvaAmount),
      monthlyInclMva: Math.round(monthlyInclMva),
      perUserInclMva: teamSize > 0 ? Math.round(monthlyInclMva / teamSize) : 0,
      discountPercent,
      savings: Math.round((baseMonthlyExMva - monthlyExMva) * (1 + mvaRate)),
      yearlyInclMva: Math.round(monthlyInclMva * 12),
    };
  };

  const enterprisePrice = calculateEnterprisePrice();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Auth
  const { user } = useAuth();
  
  // External Data Service integration for geographic company data
  const { 
    getBRREGCompanyData,
    searchBRREGCompanies,
    getKartverketAddress,
    searchKartverketPlaceNames,
    calculateTravelCosts
} = useExternalData();
  const [brregCompanies, setBrregCompanies] = useState<BrregCompany[]>([]);
  const [brregLoading, setBrregLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<BrregCompany | null>(
    null,
  );
  
  // Geographic Company Data State
  const [companyLocationData, setCompanyLocationData] = useState<any>(null);
  const [travelCosts, setTravelCosts] = useState<any>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const normalizedOrganizationNumber = normalizeNorwegianOrganizationNumber(
    formData.organizationNumber,
  );
  const organizationNumberIsValid = isValidNorwegianOrganizationNumber(
    normalizedOrganizationNumber,
  );

  const submitMutation = useMutation({
    mutationFn: async (data: InviteRequestData) => {
      return apiRequest("/api/invite-requests", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response: any) => {
      setSubmitSuccess(true);
      onSubmitSuccess?.();
      onSuccess?.();

      // Data is already stored in database via /api/invite-requests
      // No need for duplicate KV storage - admin will approve from database
      console.log('Invite request submitted successfully: ', {
        requestId: response?.requestId || response?.id,
        email: formData.email,
        profession: formData.profession,
        selectedPlan: selectedPlan?.name
      });

      // Slice 9X.55 — Prototype-testere skal IKKE redirectes til Stripe-flyt;
      // de venter på admin-godkjenning og får NDA-lenke på e-post.
      const isPrototypeTester =
        selectedPlan?.id === 'prototype_tester' ||
        (selectedPlan as any)?.tier === 'prototype_tester' ||
        formData.profession === 'prototype_tester' ||
        source === 'prototype_tester_pricing';

      // Lukk modalen etter en kort delay som viser suksess-melding
      setTimeout(() => {
        onClose();
        setSubmitSuccess(false); // Reset for next use

        if (isPrototypeTester) {
          // Bli på landingen; suksess-skjermen har allerede gitt beskjed.
          return;
        }
        // Vanlig flyt: redirect til subscription-selection
        window.location.href = `/subscription-selection?profession=${formData.profession}&requestId=${response?.requestId || response?.id}`;
      }, 3000);
    },
  });

  const handleInputChange =
    (field: keyof InviteRequestData) =>
    (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any,
    ) => {
      const value = event.target?.value ?? event.target.value;
      setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // BRREG search function with debouncing
  const searchBrregCompanies = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setBrregCompanies([]);
      return;
}

    setBrregLoading(true);

    try {
      // Check if it's an organization number (only digits)
      const isOrgNumber = /^\d+$/.test(searchTerm);

      let url: string;
      if (isOrgNumber && searchTerm.length <= 9) {
        // Search by organization number
        url = `https://data.brreg.no/enhetsregisteret/api/enheter?organisasjonsnummer=${searchTerm}*&size=10`;
    } else {
        // Search by name
        url = `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(searchTerm)}*&size=10`;
    }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Feil ved søk i Brønnøysundregistrene");
    }

      const data = await response.json();
      setBrregCompanies(data._embedded?.enheter || []);
  } catch (error) {
      console.error("BRREG search error:", error);
      setBrregCompanies([]);
  } finally {
      setBrregLoading(false);
  }
};

  // Debounced search function
  const debouncedSearch = useCallback((searchTerm: string) => {
    const timer = setTimeout(() => {
      searchBrregCompanies(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Geographic Company Data Functions
  const fetchCompanyLocationData = useCallback(async (company: BrregCompany) => {
    if (!company || !company.forretningsadresse) return;
    
    setLocationLoading(true);
    try {
      // Get detailed company data from BRREG
      const companyData = await getBRREGCompanyData(company.organisasjonsnummer);
      
      // Get address information from Kartverket
      const address = company.forretningsadresse.adresse;
      const postalCode = company.forretningsadresse.postnummer;
      const city = company.forretningsadresse.poststed;
      const fullAddress = `${address}, ${postalCode} ${city}`;
      
      const addressData = await getKartverketAddress(fullAddress);
      
      // Calculate travel costs if we have coordinates
      if (addressData.coordinates) {
        const travelCost = await calculateTravelCosts({
          kilometers: 50, // Default distance
          vehicleType: 'car',
          returnTrip: true
      });
        setTravelCosts(travelCost);
    }
      
      setCompanyLocationData({
        company: companyData,
        address: addressData,
        coordinates: addressData.coordinates
    });
      
  } catch (error) {
      console.warn('Failed to fetch company location data:', error);
  } finally {
      setLocationLoading(false);
  }
}, [getBRREGCompanyData, getKartverketAddress, calculateTravelCosts]);

  // Handle company selection
  const handleCompanySelect = (company: BrregCompany | null) => {
    setSelectedCompany(company);
    
    // Fetch geographic data when company is selected
    if (company) {
      fetchCompanyLocationData(company);
  } else {
      setCompanyLocationData(null);
      setTravelCosts(null);
  }

    if (company) {
      const address: any = company.forretningsadresse || company.beliggenhetsadresse || company.adresse;
      const formattedAddress = address
        ? `${address.adresse || address.adresselinje1 || ", "}, ${address.postnummer || ", "} ${address.poststed || ", "}`.trim()
        : ", ";

      setFormData((prev) => ({
        ...prev,
        companyName: company.navn,
        organizationNumber: company.organisasjonsnummer,
        businessAddress: formattedAddress,
    }));
  }
};

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Slice 9X.55 + 9X.56 — Prepend strukturerte tags så admin/auto-broen
    // får tak i tester-profesjon og evt. team-størrelse uten egne DB-kolonner.
    const metaTags: string[] = [];
    if (formData.profession === 'prototype_tester' && testerProfession) {
      const label = professionLabels[testerProfession as keyof typeof professionLabels] || testerProfession;
      metaTags.push(`[Tester-profesjon: ${label}]`);
    }
    if (formData.profession === 'prototype_tester' && isTesterTeamApplication) {
      metaTags.push(`[Team: ${testerTeamSize} medlemmer]`);
    }
    const messageWithMeta = metaTags.length > 0
      ? `${metaTags.join(' ')}\n\n${formData.message || ''}`
      : formData.message;

    // Include selected subscription plan in submission
    const submissionData = {
      ...formData,
      message: messageWithMeta,
      selectedPlan: selectedPlan?.id || null,
      planName: selectedPlan?.name || null,
      planPrice: selectedPlan?.price || null,
      source: source || "landing",
      // Include enterprise team size and pricing if applicable
      ...(isEnterprisePlan ? {
        enterpriseTeamSize: teamSize,
        enterprisePricing: {
          monthlyInclMva: enterprisePrice.monthlyInclMva,
          yearlyInclMva: enterprisePrice.yearlyInclMva,
          discountPercent: enterprisePrice.discountPercent,
        }
      } : {}),
    };

    console.log('📤 Submitting invite request with payment info:', {
      profession: submissionData.profession,
      selectedPlan: submissionData.selectedPlan,
      planName: submissionData.planName,
      source: submissionData.source,
      enterpriseTeamSize: isEnterprisePlan ? teamSize : undefined,
      enterprisePricing: isEnterprisePlan ? submissionData.enterprisePricing : undefined,
    });

    submitMutation.mutate(submissionData);
  };

  // Step navigation handlers
  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  // Validate current step
  const isStepValid = (step: number) => {
    if (step === 0) {
      return formData.firstName && formData.lastName && formData.email && formData.profession;
    }
    if (step === 1) {
      return formData.companyName && organizationNumberIsValid;
    }
    if (isEnterprisePlan && step === 2) {
      return teamSize >= 3;
    }
    return true;
  };

  // Get volume discount label
  const getVolumeDiscountLabel = (size: number) => {
    if (size >= 100) return '25% rabatt';
    if (size >= 50) return '18% rabatt';
    if (size >= 25) return '12% rabatt';
    if (size >= 10) return '5% rabatt';
    return 'Ingen rabatt';
  };

  // Get profession labels from theming system
  const getProfessionLabel = (key: string) => {
    const branding = theming.getProfessionBranding(key);
    return branding.label;
  };

  const professionLabels = {
    photographer: getProfessionLabel('photographer'),
    videographer: getProfessionLabel('videographer'),
    music_producer: getProfessionLabel('music_producer'),
    vendor: getProfessionLabel('vendor'),
    prototype_tester: getProfessionLabel('prototype_tester'),
  };

  // Slice 9X.55 — Design-løft: match landing-siden (mørk gradient, #ffba6c
  // accent, Space Grotesk, pill-knapper). Spesialvariant hvis prototype-tester.
  const isPrototypeTesterFlow =
    selectedPlan?.id === 'prototype_tester' ||
    (selectedPlan as any)?.tier === 'prototype_tester' ||
    source === 'prototype_tester_pricing';

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "24px",
          maxHeight: "92vh",
          background:
            'radial-gradient(circle at top, rgba(255,186,108,0.10) 0%, rgba(15,10,7,0.98) 36%, #0a0807 100%)',
          color: '#fff5e8',
          border: '1px solid rgba(255,186,108,0.18)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          // Lyse felter beholder MUI-default; vi overstyrer kun container-stil
          '& .MuiInputLabel-root': { color: 'rgba(246,242,234,0.72)' },
          '& .MuiInputLabel-root.Mui-focused': { color: '#ffba6c' },
          '& .MuiOutlinedInput-root': {
            color: '#fff5e8',
            '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
            '&:hover fieldset': { borderColor: 'rgba(255,186,108,0.4)' },
            '&.Mui-focused fieldset': { borderColor: '#ffba6c' },
          },
          '& .MuiSelect-icon': { color: 'rgba(246,242,234,0.72)' },
          '& .MuiStepLabel-label': { color: 'rgba(246,242,234,0.72)' },
          '& .MuiStepLabel-label.Mui-active': { color: '#ffba6c', fontWeight: 600 },
          '& .MuiStepLabel-label.Mui-completed': { color: '#fff5e8' },
          '& .MuiStepIcon-root': { color: 'rgba(255,255,255,0.18)' },
          '& .MuiStepIcon-root.Mui-active, & .MuiStepIcon-root.Mui-completed': { color: '#ffba6c' },
          '& .MuiTypography-root': { color: 'inherit' },
          '& .MuiDivider-root': { borderColor: 'rgba(255,255,255,0.08)' },
      }}}
    >
      <DialogTitle
        sx={{
          pb: 2,
          background:
            'linear-gradient(135deg, rgba(255,186,108,0.18) 0%, rgba(255,186,108,0.04) 100%)',
          color: '#fff5e8',
          position: 'relative',
          textAlign: 'center',
          borderBottom: '1px solid rgba(255,186,108,0.18)',
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            py: 1.5,
          }}
        >
          <Box
            component="img"
            src="/creatorhub-wordmark-light.png"
            alt="CreatorHub Norge"
            sx={{ width: 110, height: 'auto', opacity: 0.95 }}
          />
          {isPrototypeTesterFlow && (
            <Typography
              sx={{
                fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                fontSize: '0.72rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#ffba6c',
                mt: 0.5,
              }}
            >
              Plass-begrenset · Prototype-tester
            </Typography>
          )}
          <Typography
            variant="h5"
            component="div"
            sx={{
              fontFamily: '"Space Grotesk", "Manrope", sans-serif',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#fff5e8',
            }}
          >
            {isPrototypeTesterFlow
              ? 'Søk om plass i prototype-tester-programmet'
              : 'Be om tilgang til CreatorHub Norge'}
          </Typography>
          {isPrototypeTesterFlow && (
            <Typography
              variant="body2"
              sx={{ color: 'rgba(246,242,234,0.72)', maxWidth: 480, lineHeight: 1.6 }}
            >
              CreatorHub-teamet gjennomgår alle søknader personlig. Du får svar på e-post innen 1–3 virkedager.
            </Typography>
          )}
        </Box>
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 12,
            top: 12,
            color: 'rgba(246,242,234,0.72)',
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff5e8' },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 3, pb: 0 }}>
        {submitSuccess ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Tilgangsforespørselen er sendt inn!
            </Typography>
            <Typography sx={{ mb: 2 }}>
              Takk for din forespørsel, {formData.firstName}. Forespørselen din
              venter nå på godkjenning fra CreatorHub Norge.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Du vil motta en e-post med påloggingsinformasjon når forespørselen
              er godkjent.
            </Typography>
            <Typography variant="h6" color="warning.main" sx={{ fontWeight: 'bold' }}>
              Vennligst vent på godkjenning - ikke prøv å logge inn før du
              får bekreftelses-e-post
            </Typography>
          </Alert>
        ) : (
          <Box>
            {/* Stepper */}
            <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {submitMutation.error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {submitMutation.error instanceof Error
                  ? submitMutation.error.message
                  : "En feil oppstod ved innsending av forespørsel"}
              </Alert>
            )}

            <Box
              component="form"
              id="invite-request-form"
              onSubmit={handleSubmit}
              sx={{ mt: 2 }}
            >
              {/* STEP 0: Personal Information */}
              {activeStep === 0 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600}}>
                    👤 Personlig informasjon
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: "1fr 1fr"}}
                  >
                    <TextField
                      label="Fornavn"
                      value={formData.firstName}
                      onChange={handleInputChange("firstName")}
                      required
                      fullWidth
                    />
                    <TextField
                      label="Etternavn"
                      value={formData.lastName}
                      onChange={handleInputChange("lastName")}
                      required
                      fullWidth
                    />
                  </Box>

                  <TextField
                    label="E-postadresse"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange("email")}
                    required
                    fullWidth
                    sx={{ mt: 2 }}
                  />

                  <FormControl fullWidth required sx={{ mt: 2 }}>
                    <InputLabel>Yrke/Rolle</InputLabel>
                    <Select
                      value={formData.profession}
                      onChange={handleInputChange("profession")}
                      label="Yrke/Rolle"
                    >
                      {Object.entries(professionLabels).map(([key, label]) => (
                        <MenuItem key={key} value={key}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {formData.profession === "prototype_tester" && (
                    <>
                      <Alert severity="info" icon={<ScienceIcon fontSize="small" />} sx={{ mt: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          Prototype Tester Program
                        </Typography>
                        <Typography variant="body2">
                          Som prototype tester får du tidlig tilgang til nye
                          funksjoner og verktøy. Du vil være med på å forme fremtiden
                          til CreatorHub Norge.
                        </Typography>
                      </Alert>

                      <FormControl fullWidth required sx={{ mt: 2 }}>
                        <InputLabel>Din faktiske profesjon</InputLabel>
                        <Select
                          value={testerProfession}
                          onChange={(e) => setTesterProfession(e.target.value)}
                          label="Din faktiske profesjon"
                        >
                          {Object.entries(professionLabels)
                            .filter(([key]) => key !== 'prototype_tester')
                            .map(([key, label]) => (
                              <MenuItem key={key} value={key}>{label}</MenuItem>
                            ))}
                        </Select>
                        <Typography variant="caption" sx={{ mt: 0.5, color: 'rgba(246,242,234,0.6)' }}>
                          Hjelper oss å fordele testere riktig på tvers av plattformens funksjoner.
                        </Typography>
                      </FormControl>

                      {/* Slice 9X.56 — Team-valg */}
                      <Box sx={{ mt: 2, p: 2, border: '1px dashed rgba(255,186,108,0.32)', borderRadius: '12px' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, color: '#ffba6c' }}>
                          Er du alene eller del av et team?
                        </Typography>
                        <Box
                          component="label"
                          sx={{ display: 'flex', gap: 1.5, alignItems: 'center', cursor: 'pointer', py: 0.5 }}
                        >
                          <input
                            type="radio"
                            name="tester-team-application"
                            checked={!isTesterTeamApplication}
                            onChange={() => setIsTesterTeamApplication(false)}
                          />
                          <Box>
                            <Typography variant="body2">Bare meg</Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.6)' }}>
                              Du tester alene. Får 12 mnd gratis Professional etter perioden.
                            </Typography>
                          </Box>
                        </Box>
                        <Box
                          component="label"
                          sx={{ display: 'flex', gap: 1.5, alignItems: 'center', cursor: 'pointer', py: 0.5 }}
                        >
                          <input
                            type="radio"
                            name="tester-team-application"
                            checked={isTesterTeamApplication}
                            onChange={() => setIsTesterTeamApplication(true)}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2">Team (du + inntil 4 medlemmer)</Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.6)' }}>
                              Du blir team-master. Inviterer resten selv fra dashboard. Alle har felles slutt-dato.
                            </Typography>
                          </Box>
                        </Box>
                        {isTesterTeamApplication && (
                          <FormControl size="small" sx={{ mt: 1.5, maxWidth: 220 }}>
                            <InputLabel>Antall personer (inkl. deg)</InputLabel>
                            <Select
                              value={testerTeamSize}
                              onChange={(e) => setTesterTeamSize(Number(e.target.value))}
                              label="Antall personer (inkl. deg)"
                            >
                              {[2, 3, 4, 5].map((n) => (
                                <MenuItem key={n} value={n}>{n} personer</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      </Box>
                    </>
                  )}
                </Box>
              )}

              {/* STEP 1: Company Information */}
              {activeStep === 1 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600}}>
                    Bedriftsinformasjon (obligatorisk)
                  </Typography>

                  <Alert severity="info" sx={{ mb: 2 }}>
                    Organisasjonsnummer er obligatorisk. CreatorHub validerer mot
                    Brønnøysundregistrene og kjører automatisk Proff-screening
                    før admin kan behandle forespørselen.
                  </Alert>

                  <Box sx={{ mb: 2 }}>
                    <Autocomplete
                      options={brregCompanies}
                      value={selectedCompany}
                      onChange={(_, newValue) => handleCompanySelect(newValue)}
                      getOptionLabel={(option) =>
                        `${option.navn} (${option.organisasjonsnummer})`
                      }
                      renderOption={(props, option) => (
                        <Box component="li" {...props}>
                          <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                            <BusinessIcon sx={{ mr: 1, color: "primary.main" }} />
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="body1" sx={{ fontWeight: 500}}>
                                {option.navn}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Org.nr: {option.organisasjonsnummer} • {option.organisasjonsform?.beskrivelse}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Søk bedrift (navn eller organisasjonsnummer)"
                          placeholder="Skriv bedriftsnavn eller org.nr..."
                          required
                          helperText="Start å skrive for å søke i Brønnøysundregistrene"
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon color="action" />
                              </InputAdornment>
                            ),
                            endAdornment: (
                              <>
                                {brregLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                {params.InputProps.endAdornment}
                              </>
                            )}}
                          onChange={(e: any) => {
                            params.inputProps.onChange?.(e);
                            debouncedSearch(e.target.value);
                          }}
                        />
                      )}
                      loading={brregLoading}
                      noOptionsText="Ingen bedrifter funnet"
                      sx={{ mb: 2 }}
                    />

                    {selectedCompany && (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          Bedrift valgt fra BRREG
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                          <Chip size="small" label={selectedCompany.navn} color="primary" variant="outlined" />
                          <Chip size="small" label={`Org.nr: ${selectedCompany.organisasjonsnummer}`} color="default" variant="outlined" />
                          <Chip size="small" label={selectedCompany.organisasjonsform?.beskrivelse} color="secondary" variant="outlined" />
                        </Box>
                      </Alert>
                    )}
                  </Box>

                  <TextField
                    label="Bedriftsnavn"
                    value={formData.companyName}
                    onChange={handleInputChange("companyName")}
                    required
                    fullWidth
                    sx={{ mb: 2 }}
                    helperText={selectedCompany ? "Auto-utfylt fra BRREG" : "Fullt navn på ditt firma/selskap"}
                    InputProps={{
                      readOnly: !!selectedCompany,
                      sx: { backgroundColor: selectedCompany ? "action.hover" : "inherit", opacity: selectedCompany ? 0.7 : 1 }}}
                  />

                  <TextField
                    label="Organisasjonsnummer"
                    value={formData.organizationNumber}
                    onChange={(event) => {
                      const nextValue = normalizeNorwegianOrganizationNumber(
                        event.target.value,
                      );
                      setFormData((prev) => ({
                        ...prev,
                        organizationNumber: nextValue,
                      }));
                    }}
                    required
                    fullWidth
                    sx={{ mb: 2 }}
                    error={
                      Boolean(formData.organizationNumber) &&
                      !organizationNumberIsValid
                    }
                    helperText={
                      selectedCompany
                        ? "Auto-utfylt fra BRREG og screenes automatisk."
                        : formData.organizationNumber &&
                            !organizationNumberIsValid
                          ? "Må være et gyldig 9-sifret norsk organisasjonsnummer."
                          : "9-sifret organisasjonsnummer. Dette screenes automatisk via BRREG og Proff."
                    }
                    InputProps={{
                      readOnly: !!selectedCompany,
                      sx: { backgroundColor: selectedCompany ? "action.hover" : "inherit", opacity: selectedCompany ? 0.7 : 1 }}}
                  />

                  <TextField
                    label="Forretningsadresse"
                    value={formData.businessAddress}
                    onChange={handleInputChange("businessAddress")}
                    fullWidth
                    sx={{ mb: 2 }}
                    helperText={selectedCompany ? "Auto-utfylt fra BRREG" : "Full adresse til bedriftens hovedkontor"}
                    InputProps={{
                      readOnly: !!selectedCompany,
                      sx: { backgroundColor: selectedCompany ? "action.hover" : "inherit", opacity: selectedCompany ? 0.7 : 1 }}}
                  />

                  <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "1fr 1fr", mb: 2 }}>
                    <TextField
                      label="Telefonnummer"
                      value={formData.phoneNumber}
                      onChange={handleInputChange("phoneNumber")}
                      helperText="Bedriftens kontakttelefon"
                    />
                    <TextField
                      label="Nettside"
                      value={formData.website}
                      onChange={handleInputChange("website")}
                      helperText="Bedriftens hjemmeside (valgfritt)"
                    />
                  </Box>

                  <TextField
                    label="Melding til admin (valgfritt)"
                    value={formData.message}
                    onChange={handleInputChange("message")}
                    multiline
                    rows={2}
                    fullWidth
                    helperText="Beskriv kort din bakgrunn og hvorfor du ønsker tilgang"
                  />
                </Box>
              )}

              {/* STEP 2 (Enterprise only): Team Size & Pricing */}
              {isEnterprisePlan && activeStep === 2 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PeopleIcon sx={{ color: '#9c27b0' }} />
                    Team størrelse og prising
                  </Typography>

                  <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="body2">
                      <strong>Enterprise inkluderer {pricingConfig.includedUsers} brukere.</strong> Ekstra brukere koster {pricingConfig.pricePerUser} kr/mnd eks. MVA.
                      Større team gir volumrabatt!
                    </Typography>
                  </Alert>

                  {/* Team Size Slider */}
                  <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(156, 39, 176, 0.04)', border: '1px solid rgba(156, 39, 176, 0.2)' }}>
                    <Typography gutterBottom sx={{ fontWeight: 600, color: '#9c27b0' }}>
                      Antall teammedlemmer: <strong>{teamSize}</strong>
                    </Typography>
                    <Slider
                      value={teamSize}
                      onChange={(_, value) => setTeamSize(value as number)}
                      min={3}
                      max={100}
                      marks={[
                        { value: 3, label: '3' },
                        { value: 10, label: '10' },
                        { value: 25, label: '25' },
                        { value: 50, label: '50' },
                        { value: 100, label: '100' },
                      ]}
                      sx={{ color: '#9c27b0', mt: 2, mb: 1 }}
                    />

                    {/* Quick Select Chips */}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                      {[5, 10, 25, 50, 100].map((size) => (
                        <Chip
                          key={size}
                          label={`${size} brukere`}
                          onClick={() => setTeamSize(size)}
                          variant={teamSize === size ? 'filled' : 'outlined'}
                          sx={{
                            bgcolor: teamSize === size ? '#9c27b0' : 'transparent',
                            color: teamSize === size ? 'white' : '#9c27b0',
                            borderColor: '#9c27b0','&:hover': { bgcolor: teamSize === size ? '#7b1fa2' : 'rgba(156, 39, 176, 0.1)' }
                          }}
                        />
                      ))}
                    </Box>
                  </Paper>

                  {/* Pricing Display */}
                  <Paper sx={{ p: 3, bgcolor: 'background.paper', border: '2px solid #9c27b0' }}>
                    <Typography variant="h6" sx={{ mb: 2, color: '#9c27b0', fontWeight: 700}}>
                      Prisberegning for {teamSize} brukere
                    </Typography>

                    {enterprisePrice.discountPercent > 0 && (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          <strong>{enterprisePrice.discountPercent}% volumrabatt!</strong> Du sparer {enterprisePrice.savings.toLocaleString('nb-NO')} kr/mnd
                        </Typography>
                      </Alert>
                    )}

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography color="text.secondary">Månedspris eks. MVA:</Typography>
                        <Typography sx={{ fontWeight: 500}}>{enterprisePrice.monthlyExMva.toLocaleString('nb-NO')} kr</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography color="text.secondary">MVA (25%):</Typography>
                        <Typography sx={{ fontWeight: 500}}>{enterprisePrice.mvaAmount.toLocaleString('nb-NO')} kr</Typography>
                      </Box>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ fontWeight: 700, color: '#9c27b0' }}>Månedspris inkl. MVA:</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#9c27b0' }}>
                          {enterprisePrice.monthlyInclMva.toLocaleString('nb-NO')} kr
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography color="text.secondary">Per bruker/mnd:</Typography>
                        <Typography sx={{ fontWeight: 500}}>{enterprisePrice.perUserInclMva.toLocaleString('nb-NO')} kr</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography color="text.secondary">Årlig total:</Typography>
                        <Typography sx={{ fontWeight: 500}}>{enterprisePrice.yearlyInclMva.toLocaleString('nb-NO')} kr/år</Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="caption" color="text.secondary">
                      <strong>Volumrabatter:</strong> 10+ brukere = 5% | 25+ = 12% | 50+ = 18% | 100+ = 25%
                    </Typography>
                  </Paper>
                </Box>
              )}

              {/* FINAL STEP: Summary */}
              {activeStep === steps.length - 1 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon sx={{ color: '#4caf50' }} />
                    Bekreft din forespørsel
                  </Typography>

                  <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="body2">
                      Gå gjennom informasjonen under og klikk"Send forespørsel" for å fullføre.
                      Du vil motta en e-post med lenke for å starte onboarding-prosessen.
                    </Typography>
                  </Alert>

                  {/* Personal Info Summary */}
                  <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>👤 Personlig informasjon</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <Typography variant="body2"><strong>Navn:</strong> {formData.firstName} {formData.lastName}</Typography>
                      <Typography variant="body2"><strong>E-post:</strong> {formData.email}</Typography>
                      <Typography variant="body2"><strong>Rolle:</strong> {professionLabels[formData.profession as keyof typeof professionLabels] || formData.profession}</Typography>
                    </Box>
                  </Paper>

                  {/* Company Info Summary */}
                  <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Bedriftsinformasjon</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <Typography variant="body2"><strong>Bedrift:</strong> {formData.companyName}</Typography>
                      <Typography variant="body2"><strong>Org.nr:</strong> {formData.organizationNumber}</Typography>
                      <Typography variant="body2" sx={{ gridColumn: 'span 2' }}><strong>Adresse:</strong> {formData.businessAddress || 'Ikke oppgitt'}</Typography>
                    </Box>
                  </Paper>

                  {/* Plan Summary */}
                  <Paper sx={{ p: 2, mb: 2, bgcolor: isEnterprisePlan ? 'rgba(156, 39, 176, 0.04)' : 'background.paper', border: isEnterprisePlan ? '2px solid #9c27b0' : '1px solid', borderColor: isEnterprisePlan ? '#9c27b0' : 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: isEnterprisePlan ? '#9c27b0' : 'inherit' }}>
                      Valgt plan: {selectedPlan?.name || 'Standard'}
                    </Typography>

                    {isEnterprisePlan && (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2"><strong>Team størrelse:</strong></Typography>
                          <Chip label={`${teamSize} brukere`} size="small" sx={{ bgcolor: '#9c27b0', color: 'white' }} />
                        </Box>
                        {enterprisePrice.discountPercent > 0 && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2"><strong>Volumrabatt:</strong></Typography>
                            <Chip label={`${enterprisePrice.discountPercent}%`} size="small" color="success" />
                          </Box>
                        )}
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 700}}>Månedspris inkl. MVA:</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#9c27b0' }}>
                            {enterprisePrice.monthlyInclMva.toLocaleString('nb-NO')} kr
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {!isEnterprisePlan && selectedPlan && (
                      <Typography variant="body2">
                        <strong>Pris:</strong> {selectedPlan.price ? `${selectedPlan.price} kr/mnd` : 'Gratis'}
                      </Typography>
                    )}
                  </Paper>

                  {/* Features Preview */}
                  {formData.profession && selectedPlan && (
                    <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Inkluderte funksjoner</Typography>
                      <PlanFeaturePreview
                        profession={formData.profession}
                        selectedPlan={selectedPlan?.id || 'basic'}
                        showLocked={false}
                        showDetails={false}
                        maxFeatures={5}
                      />
                    </Paper>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      {!submitSuccess && (
        <DialogActions
          sx={{
            p: 3,
            pt: 2,
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <Box>
            {activeStep > 0 && (
              <Button
                onClick={handleBack}
                variant="outlined"
                sx={{
                  mr: 1,
                  borderRadius: '999px',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 2.5,
                  color: '#fff5e8',
                  borderColor: 'rgba(255,255,255,0.18)',
                  '&:hover': { borderColor: '#fff5e8', bgcolor: 'rgba(255,255,255,0.04)' },
                }}
              >
                Tilbake
              </Button>
            )}
          </Box>
          <Box>
            <Button
              onClick={onClose}
              variant="text"
              sx={{
                mr: 1,
                color: 'rgba(246,242,234,0.6)',
                textTransform: 'none',
                fontWeight: 500,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', color: '#fff5e8' },
              }}
            >
              Avbryt
            </Button>
            {activeStep < steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!isStepValid(activeStep)}
                sx={{
                  borderRadius: '999px',
                  px: 3,
                  py: 1.1,
                  fontWeight: 700,
                  textTransform: 'none',
                  bgcolor: '#ffba6c',
                  color: '#150d05',
                  '&:hover': { bgcolor: '#ffc788' },
                  '&.Mui-disabled': { bgcolor: 'rgba(255,186,108,0.3)', color: 'rgba(21,13,5,0.5)' },
                }}
              >
                Neste
              </Button>
            ) : (
              <Button
                type="submit"
                form="invite-request-form"
                variant="contained"
                disabled={submitMutation.isPending}
                sx={{
                  borderRadius: '999px',
                  px: 3,
                  py: 1.1,
                  fontWeight: 700,
                  textTransform: 'none',
                  bgcolor: '#ffba6c',
                  color: '#150d05',
                  '&:hover': { bgcolor: '#ffc788' },
                  '&.Mui-disabled': { bgcolor: 'rgba(255,186,108,0.3)', color: 'rgba(21,13,5,0.5)' },
                }}
              >
                {submitMutation.isPending ? (
                  <>
                    <CircularProgress size={18} sx={{ mr: 1, color: '#150d05' }} />
                    Sender…
                  </>
                ) : (
                  isPrototypeTesterFlow ? 'Send søknad' : 'Send forespørsel'
                )}
              </Button>
            )}
          </Box>
        </DialogActions>
      )}
    </Dialog>
  );
}

export default InviteRequestForm;
