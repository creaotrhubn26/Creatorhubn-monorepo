/**
 * Enterprise Inquiry Form
 * Form for users to request enterprise plan upgrade
 * - Auto-populates org number and company name
 * - Team information and use case description
 * - Google Workspace verification
 */
import React, { useState, useEffect } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Slider,
} from '@mui/material';
import {
  Business,
  People,
  Email,
  CheckCircle,
  Warning,
  Google,
  Send,
  Close,
  Storage,
  CalendarMonth,
  VideoCall,
  Description,
} from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';

interface EnterprisePricingConfig {
  // Prices ex. MVA (before tax)
  basePrice: number;
  basePriceAnnual: number;
  pricePerUser: number;
  pricePerUserAnnual: number;
  // Prices incl. MVA (with 25% Norwegian tax)
  basePriceInclMva: number;
  basePriceAnnualInclMva: number;
  pricePerUserInclMva: number;
  pricePerUserAnnualInclMva: number;
  // MVA info
  mvaRate: number;
  mvaPercent: number;
  // Other
  includedUsers: number;
  volumeDiscounts: Array<{ minUsers: number; discount: number }>;
  currency: string;
}

interface EnterpriseInquiryFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  // Pre-populated data from user's existing profile
  existingOrgNumber?: string;
  existingCompanyName?: string;
  existingEmail?: string;
  existingProfession?: string;
  currentPlan?: string;
}

interface GoogleWorkspaceCheckResult {
  isWorkspace: boolean;
  domain?: string;
  mxRecords?: string[];
  hasGoogleMX?: boolean;
}

const ENTERPRISE_FEATURES = [
  { icon: <People />, title: 'Team-administrasjon', desc: 'Administrer alle brukere fra ett sted' },
  { icon: <Storage />, title: 'Utvidet lagring', desc: 'Ubegrenset Google Drive lagring' },
  { icon: <CalendarMonth />, title: 'Delt kalender', desc: 'Felles timeplanlegging for teamet' },
  { icon: <VideoCall />, title: 'Google Meet', desc: 'Videomøter med kunder og team' },
  { icon: <Description />, title: 'Delte dokumenter', desc: 'Sanntids samarbeid på kontrakter' },
];

export function EnterpriseInquiryForm({
  open,
  onClose,
  onSuccess,
  existingOrgNumber = '',
  existingCompanyName = '',
  existingEmail = '',
  existingProfession = '',
  currentPlan = 'pro',
}: EnterpriseInquiryFormProps) {
  const theming = useTheming(existingProfession || 'photographer');
  
  // Form state
  const [orgNumber, setOrgNumber] = useState(existingOrgNumber);
  const [companyName, setCompanyName] = useState(existingCompanyName);
  const [contactEmail, setContactEmail] = useState(existingEmail);
  const [teamSize, setTeamSize] = useState<number>(3);
  const [teamDescription, setTeamDescription] = useState('');
  const [useCase, setUseCase] = useState('');
  const [additionalMessage, setAdditionalMessage] = useState('');
  const [industry, setIndustry] = useState(existingProfession);
  
  // Google Workspace check state
  const [workspaceStatus, setWorkspaceStatus] = useState<GoogleWorkspaceCheckResult | null>(null);
  const [checkingWorkspace, setCheckingWorkspace] = useState(false);

  // Fetch enterprise pricing configuration
  const { data: pricingConfigData } = useQuery({
    queryKey: ['enterprise-pricing-config'],
    queryFn: async () => {
      const response = await apiRequest('/api/enterprise/pricing/config');
      return response.data as EnterprisePricingConfig;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const pricingConfig = pricingConfigData || {
    basePrice: 1499,
    basePriceAnnual: 14990,
    pricePerUser: 299,
    pricePerUserAnnual: 2990,
    basePriceInclMva: 1874,
    basePriceAnnualInclMva: 18738,
    pricePerUserInclMva: 374,
    pricePerUserAnnualInclMva: 3738,
    mvaRate: 0.25,
    mvaPercent: 25,
    includedUsers: 3,
    volumeDiscounts: [
      { minUsers: 10, discount: 5 },
      { minUsers: 25, discount: 10 },
      { minUsers: 50, discount: 15 },
    ],
    currency: 'NOK'
  };

  // Calculate estimated price based on team size (prices incl. MVA)
  const calculateEstimatedPrice = () => {
    const extraUsers = Math.max(0, teamSize - pricingConfig.includedUsers);

    // Calculate ex. MVA first
    const baseMonthlyExMva = pricingConfig.basePrice + (extraUsers * pricingConfig.pricePerUser);

    // Find applicable discount
    const applicableDiscount = pricingConfig.volumeDiscounts
      .filter(d => teamSize >= d.minUsers)
      .sort((a, b) => b.minUsers - a.minUsers)[0];

    const discountPercent = applicableDiscount?.discount || 0;
    const monthlyExMva = baseMonthlyExMva * (1 - discountPercent / 100);

    // Add MVA (25%)
    const mvaRate = pricingConfig.mvaRate || 0.25;
    const mvaAmount = monthlyExMva * mvaRate;
    const monthlyInclMva = monthlyExMva + mvaAmount;

    return {
      monthlyExMva: Math.round(monthlyExMva),
      mvaAmount: Math.round(mvaAmount),
      monthly: Math.round(monthlyInclMva), // incl. MVA
      perUserExMva: teamSize > 0 ? Math.round(monthlyExMva / teamSize) : 0,
      perUser: teamSize > 0 ? Math.round(monthlyInclMva / teamSize) : 0, // incl. MVA
      discount: discountPercent,
      savings: Math.round((baseMonthlyExMva - monthlyExMva) * (1 + mvaRate)),
      mvaPercent: pricingConfig.mvaPercent || 25
    };
  };

  const estimatedPrice = calculateEstimatedPrice();

  // Update form when props change
  useEffect(() => {
    if (existingOrgNumber) setOrgNumber(existingOrgNumber);
    if (existingCompanyName) setCompanyName(existingCompanyName);
    if (existingEmail) setContactEmail(existingEmail);
    if (existingProfession) setIndustry(existingProfession);
  }, [existingOrgNumber, existingCompanyName, existingEmail, existingProfession]);

  // Check Google Workspace when email changes
  const checkGoogleWorkspace = async (email: string) => {
    if (!email || !email.includes('@')) return;
    
    const domain = email.split('@')[1];
    // Skip common consumer domains
    const consumerDomains = ['gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','icloud.com'];
    if (consumerDomains.includes(domain.toLowerCase())) {
      setWorkspaceStatus({ isWorkspace: false, domain, hasGoogleMX: false });
      return;
    }
    
    setCheckingWorkspace(true);
    try {
      const result = await apiRequest('/api/google-workspace/check-domain', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setWorkspaceStatus({
        isWorkspace: result.isGoogleWorkspace,
        domain: result.domain,
        hasGoogleMX: result.isGoogleWorkspace,
      });
    } catch {
      // If API fails, assume it might be workspace (benefit of doubt)
      setWorkspaceStatus({ isWorkspace: true, domain, hasGoogleMX: true });
    } finally {
      setCheckingWorkspace(false);
    }
  };

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/enterprise/inquiries', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
  });

  const handleSubmit = () => {
    const inquiryData = {
      orgNumber,
      companyName,
      contactEmail,
      teamSize,
      teamDescription,
      useCase,
      additionalMessage,
      industry,
      currentPlan,
      hasGoogleWorkspace: workspaceStatus?.isWorkspace || false,
      workspaceDomain: workspaceStatus?.domain,
      submittedAt: new Date().toISOString(),
    };
    submitMutation.mutate(inquiryData);
  };

  const isFormValid = orgNumber && companyName && contactEmail && teamSize >= 3 && useCase && workspaceStatus?.isWorkspace;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{
        bgcolor: theming.colors.light,
        color: theming.colors.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Business sx={{ color: '#9c27b0' }} />
          <Typography variant="h6">Enterprise-forespørsel</Typography>
        </Box>
        <Button onClick={onClose} sx={{ minWidth: 'auto' }}>
          <Close />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: theming.colors.light }}>
        {/* Info Alert */}
        <Alert severity="info" sx={{ mb: 3, mt: 2 }}>
          <Typography variant="body2">
            <strong>Enterprise er for team og bedrifter.</strong> Minimum 3 brukere kreves.
            For å få tilgang til alle funksjoner inkludert Google Workspace-integrasjon,
            må alle team-medlemmer ha en Google Workspace-konto på samme domene.
          </Typography>
        </Alert>

        {/* Company Information - Auto-populated */}
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
          Bedriftsinformasjon
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
          <TextField
            label="Organisasjonsnummer"
            value={orgNumber}
            onChange={(e) => setOrgNumber(e.target.value)}
            fullWidth
            required
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Business />
                  </InputAdornment>
                ),
              }}}
            helperText={existingOrgNumber ? "Hentet fra din profil" : ""}
          />
          <TextField
            label="Bedriftsnavn"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            fullWidth
            required
            helperText={existingCompanyName ? "Hentet fra din profil" : ""}
          />
        </Box>

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Bransje</InputLabel>
          <Select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            label="Bransje"
          >
            <MenuItem value="photographer">Fotograf</MenuItem>
            <MenuItem value="videographer">Videograf</MenuItem>
            <MenuItem value="music_producer">Musikkprodusent</MenuItem>
            <MenuItem value="agency">Byrå</MenuItem>
            <MenuItem value="studio">Studio</MenuItem>
            <MenuItem value="other">Annet</MenuItem>
          </Select>
        </FormControl>

        <Divider sx={{ my: 3 }} />

        {/* Team Information */}
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
          Team-informasjon
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Typography gutterBottom>
            Antall brukere: <strong>{teamSize}</strong>
          </Typography>
          <Slider
            value={teamSize}
            onChange={(_, value) => setTeamSize(value as number)}
            min={3}
            max={50}
            marks={[
              { value: 3, label: '3' },
              { value: 10, label: '10' },
              { value: 25, label: '25' },
              { value: 50, label: '50+' },
            ]}
            sx={{ color: '#9c27b0' }}
          />
          {teamSize < 3 && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Enterprise krever minimum 3 brukere
            </Alert>
          )}

          {/* Dynamic Pricing Preview with Norwegian MVA */}
          <Box sx={{
            mt: 2,
            p: 2,
            bgcolor: 'rgba(156, 39, 176, 0.08)',
            borderRadius: 2,
            border: '1px solid rgba(156, 39, 176, 0.2)'
          }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#9c27b0', fontWeight: 600}}>
              Estimert pris for {teamSize} brukere
            </Typography>

            {/* Price incl. MVA (main price) */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#9c27b0' }}>
                {estimatedPrice.monthly.toLocaleString('nb-NO')} kr
              </Typography>
              <Typography variant="body2" color="text.secondary">
                /mnd inkl. MVA
              </Typography>
              {estimatedPrice.discount > 0 && (
                <Chip
                  label={`-${estimatedPrice.discount}% volum`}
                  size="small"
                  sx={{ bgcolor: '#4caf50', color: 'white' }}
                />
              )}
            </Box>

            {/* Price breakdown */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              ({estimatedPrice.monthlyExMva.toLocaleString('nb-NO')} kr ex. MVA + {estimatedPrice.mvaAmount.toLocaleString('nb-NO')} kr MVA)
            </Typography>

            <Typography variant="body2" color="text.secondary">
              = {estimatedPrice.perUser.toLocaleString('nb-NO')} kr per bruker/mnd inkl. MVA
            </Typography>

            {estimatedPrice.savings > 0 && (
              <Typography variant="body2" sx={{ color: '#4caf50', mt: 0.5 }}>
                Du sparer {estimatedPrice.savings.toLocaleString('nb-NO')} kr/mnd med volumrabatt!
              </Typography>
            )}

            <Divider sx={{ my: 1.5, borderColor: 'rgba(156, 39, 176, 0.2)' }} />

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              <strong>Prisdetaljer (ex. MVA):</strong><br />
              Basispris: {pricingConfig.basePrice.toLocaleString('nb-NO')} kr ({pricingConfig.includedUsers} brukere inkl.)<br />
              Per ekstra bruker: {pricingConfig.pricePerUser.toLocaleString('nb-NO')} kr/mnd<br />
              MVA ({pricingConfig.mvaPercent || 25}%) legges til alle priser
            </Typography>
          </Box>
        </Box>

        <TextField
          label="Beskriv teamet ditt"
          value={teamDescription}
          onChange={(e) => setTeamDescription(e.target.value)}
          fullWidth
          multiline
          rows={2}
          sx={{ mb: 3 }}
          placeholder="F.eks: Vi er et team på 5 fotografer som jobber med bryllup og events..."
        />

        <TextField
          label="Hvorfor ønsker dere Enterprise?"
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          fullWidth
          multiline
          rows={3}
          required
          sx={{ mb: 3 }}
          placeholder="Beskriv hvordan dere vil bruke Enterprise-funksjonene..."
        />

        <Divider sx={{ my: 3 }} />

        {/* Google Workspace Check */}
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
          Google Workspace-verifisering
        </Typography>

        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Viktig:</strong> For full Enterprise-funksjonalitet må alle team-medlemmer
            ha en Google Workspace-konto. Dette gir tilgang til delt lagring, kalender,
            videomøter og sanntids dokumentsamarbeid.
          </Typography>
        </Alert>

        <TextField
          label="Kontakt e-post (Google Workspace)"
          value={contactEmail}
          onChange={(e) => {
            setContactEmail(e.target.value);
            // Debounce the workspace check
            const timeoutId = setTimeout(() => checkGoogleWorkspace(e.target.value), 500);
            return () => clearTimeout(timeoutId);
          }}
          fullWidth
          required
          type="email"
          sx={{ mb: 2 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Email />
                </InputAdornment>
              ),
              endAdornment: checkingWorkspace ? (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ) : workspaceStatus ? (
                <InputAdornment position="end">
                  {workspaceStatus.isWorkspace ? (
                    <Chip
                      icon={<CheckCircle />}
                      label="Google Workspace"
                      color="success"
                      size="small"
                    />
                  ) : (
                    <Chip
                      icon={<Warning />}
                      label="Ikke Workspace"
                      color="warning"
                      size="small"
                    />
                  )}
                </InputAdornment>
              ) : null,
            }}}
          helperText={
            workspaceStatus?.isWorkspace
              ? `${workspaceStatus.domain} er et Google Workspace-domene`
              : workspaceStatus
                ? "Dette ser ikke ut som et Google Workspace-domene. Google Workspace er påkrevd for å bruke denne plattformen." : "Skriv inn din bedrifts-e-post for å verifisere Google Workspace"
          }
          error={Boolean(workspaceStatus && !workspaceStatus.isWorkspace)}
        />

        {/* Workspace Features List */}
        {workspaceStatus?.isWorkspace && (
          <Box sx={{ bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 2, p: 2, mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#4caf50' }}>
              Med Google Workspace får dere tilgang til:
            </Typography>
            <List dense>
              {ENTERPRISE_FEATURES.map((feature, idx) => (
                <ListItem key={idx} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 36, color: '#4caf50' }}>
                    {feature.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={feature.title}
                    secondary={feature.desc}
                    slotProps={{
                      primary: { sx: { variant: 'body2', fontWeight: 500} },
                      secondary: { sx: { variant: 'caption' } }}}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {!workspaceStatus?.isWorkspace && workspaceStatus && (
          <Box sx={{ bgcolor: 'rgba(255, 152, 0, 0.1)', borderRadius: 2, p: 2, mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#ff9800' }}>
              Opprett Google Workspace
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              For å få tilgang til alle Enterprise-funksjoner, opprett en Google Workspace-konto for din bedrift.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<Google />}
              onClick={() => window.open('https://workspace.google.com/signup/businessstarter', '_blank')}
              sx={{ borderColor: '#ff9800', color: '#ff9800' }}
            >
              Opprett Google Workspace
            </Button>
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        {/* Additional Message */}
        <TextField
          label="Tilleggsmelding (valgfritt)"
          value={additionalMessage}
          onChange={(e) => setAdditionalMessage(e.target.value)}
          fullWidth
          multiline
          rows={2}
          placeholder="Andre spørsmål eller kommentarer..."
        />
      </DialogContent>

      <DialogActions sx={{ bgcolor: theming.colors.light, p: 2 }}>
        <Button onClick={onClose} color="inherit">
          Avbryt
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!isFormValid || submitMutation.isPending}
          startIcon={submitMutation.isPending ? <CircularProgress size={20} /> : <Send />}
          sx={{ bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
        >
          {submitMutation.isPending ? 'Sender...' : 'Send forespørsel'}
        </Button>
      </DialogActions>

      {submitMutation.isError && (
        <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
          Det oppstod en feil. Vennligst prøv igjen.
        </Alert>
      )}

      {submitMutation.isSuccess && (
        <Alert severity="success" sx={{ mx: 2, mb: 2 }}>
          Forespørselen din er sendt! Vi kontakter deg snart.
        </Alert>
      )}
    </Dialog>
  );
}

