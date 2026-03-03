import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Business as BusinessIcon,
  CheckCircle as CheckCircleIcon,
  CloudDone as CloudDoneIcon,
  Google as GoogleIcon,
  Search as SearchIcon,
  Security as SecurityIcon,
  Verified as VerifiedIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import PrototypeTesterModal from './PrototypeTesterModal';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '../../hooks/useAuth';
import { useExternalData } from '../../services/ExternalDataService';
import type { BRREGCompanyData, BRREGSearchResults } from '../../services/ExternalDataService';

const logoCreatorHub = '/creatorhub-logo-amber.svg';

const inviteSchema = z
  .object({
    businessName: z.string().min(2, 'Bedriftsnavn må være minst 2 tegn.'),
    orgNumber: z.string().regex(/^\d{9}$/, 'Organisasjonsnummer må være 9 siffer.'),
    contactName: z.string().min(2, 'Kontaktperson må være minst 2 tegn.'),
    contactEmail: z.string().email('Ugyldig e-postadresse.'),
    contactPhone: z.string().min(8, 'Telefonnummer må være minst 8 tegn.'),
    website_url_trap: z.string().max(0, 'Bot detected.').optional(),
    profession: z.string().min(1, 'Velg profesjon.'),
    specialization: z.string().optional(),
    teamSize: z.number().int().min(1, 'Teamstørrelse må være minst 1.'),
    annualRevenue: z.string().optional(),
    businessDescription: z.string().min(50, 'Bedriftsbeskrivelse må være minst 50 tegn.'),
    websiteUrl: z.string().url('Ugyldig URL.').optional().or(z.literal('')),
    currentChallenges: z.string().min(20, 'Beskriv utfordringer (minst 20 tegn).'),
    whyCreatorHub: z.string().min(30, 'Beskriv hvorfor CreatorHub Norge (minst 30 tegn).'),
    hasGoogleWorkspace: z.boolean(),
    googleWorkspaceEmail: z.string().optional(),
    acceptTerms: z.boolean().refine((value) => value, 'Du må akseptere vilkårene.'),
    acceptGoogleIntegration: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.hasGoogleWorkspace && (!value.googleWorkspaceEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.googleWorkspaceEmail))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['googleWorkspaceEmail'],
        message: 'Oppgi gyldig Google Workspace e-post.',
      });
    }
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
  message?: string;
}

interface CompanySuggestion {
  name: string;
  orgNumber: string;
  businessType: string;
}

interface SpecializedContactModalProps {
  open: boolean;
  onClose: () => void;
  defaultRole?: string;
}

const stepLabels = ['Bedrift', 'Kontakt', 'Behov', 'Bekreft', 'Ferdig'];

function mapCompanyVerification(company: BRREGCompanyData): BusinessVerificationResult {
  return {
    success: true,
    businessInfo: {
      displayName: company.name,
      orgNumber: company.organizationNumber,
      address: `${company.businessAddress.adresse}, ${company.businessAddress.postnummer} ${company.businessAddress.poststed}`,
      businessType: company.organizationForm,
      foundingYear: company.registrationDate ? company.registrationDate.slice(0, 4) : 'Ukjent',
      employeeCount: company.employees > 0 ? String(company.employees) : 'Ikke oppgitt',
      mvaRegistered: true,
    },
  };
}

function mapSuggestions(results: BRREGSearchResults): CompanySuggestion[] {
  return results.companies.slice(0, 6).map((company) => ({
    name: company.name,
    orgNumber: company.organizationNumber,
    businessType: company.organizationForm,
  }));
}

export default function SpecializedContactModal({ open, onClose, defaultRole }: SpecializedContactModalProps) {
  const { user } = useAuth();
  const { professions, loading: professionsLoading } = useDynamicProfessions();
  const { getBRREGCompanyData, searchBRREGCompanies } = useExternalData();

  const [currentStep, setCurrentStep] = useState(0);
  const [businessVerification, setBusinessVerification] = useState<BusinessVerificationResult | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [showPrototypeTesterModal, setShowPrototypeTesterModal] = useState(false);
  const [isPrototypeTester, setIsPrototypeTester] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<CompanySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const formStartedAt = useRef<number>(Date.now());

  const professionOptions = useMemo(() => {
    const entries = Object.entries(professions ?? {});
    if (entries.length === 0) {
      return [
        { value: 'photographer', label: 'Fotograf' },
        { value: 'videographer', label: 'Videograf' },
        { value: 'music_producer', label: 'Musikkprodusent' },
        { value: 'vendor', label: 'Leverandør' },
      ];
    }

    return entries
      .map(([professionId, config]) => ({
        value: professionId,
        label: config.displayName || professionId,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [professions]);

  const {
    control,
    handleSubmit,
    watch,
    register,
    setValue,
    getValues,
    trigger,
    reset,
    formState: { errors, isValid },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    mode: 'onChange',
    defaultValues: {
      businessName: '',
      orgNumber: '',
      contactName: user?.name || '',
      contactEmail: user?.email || '',
      contactPhone: '',
      website_url_trap: '',
      profession: defaultRole || user?.profession || professionOptions[0]?.value || 'vendor',
      specialization: '',
      teamSize: 1,
      annualRevenue: '',
      businessDescription: '',
      websiteUrl: '',
      currentChallenges: '',
      whyCreatorHub: '',
      hasGoogleWorkspace: false,
      googleWorkspaceEmail: user?.email || '',
      acceptTerms: false,
      acceptGoogleIntegration: false,
    },
  });

  const businessName = watch('businessName');
  const orgNumber = watch('orgNumber');
  const hasGoogleWorkspace = watch('hasGoogleWorkspace');
  const profession = watch('profession');

  useEffect(() => {
    if (!open) return;

    formStartedAt.current = Date.now();
    setCurrentStep(0);
    setBusinessVerification(null);
    setVerificationLoading(false);
    setShowPrototypeTesterModal(false);
    setIsPrototypeTester(false);
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setFormError(null);

    reset({
      businessName: '',
      orgNumber: '',
      contactName: user?.name || '',
      contactEmail: user?.email || '',
      contactPhone: '',
      website_url_trap: '',
      profession: defaultRole || user?.profession || professionOptions[0]?.value || 'vendor',
      specialization: '',
      teamSize: 1,
      annualRevenue: '',
      businessDescription: '',
      websiteUrl: '',
      currentChallenges: '',
      whyCreatorHub: '',
      hasGoogleWorkspace: false,
      googleWorkspaceEmail: user?.email || '',
      acceptTerms: false,
      acceptGoogleIntegration: false,
    });
  }, [defaultRole, open, professionOptions, reset, user?.email, user?.name, user?.profession]);

  useEffect(() => {
    if (!open) return;
    if (businessName.trim().length < 3) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        const results = await searchBRREGCompanies({ name: businessName, limit: 6 });
        const suggestions = mapSuggestions(results);
        setSearchSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } catch {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [businessName, open, searchBRREGCompanies]);

  const verifyBusiness = async (inputOrgNumber: string): Promise<void> => {
    setVerificationLoading(true);
    setFormError(null);

    try {
      const company = await getBRREGCompanyData(inputOrgNumber);
      const result = mapCompanyVerification(company);
      setBusinessVerification(result);
      if (result.businessInfo) {
        setValue('businessName', result.businessInfo.displayName, { shouldValidate: true, shouldDirty: true });
      }
    } catch {
      setBusinessVerification({
        success: false,
        message: 'Kunne ikke verifisere bedriften automatisk. Du kan fortsette manuelt.',
      });
    } finally {
      setVerificationLoading(false);
    }
  };

  const submitInviteMutation = useMutation({
    mutationFn: async (formData: InviteFormData) => {
      const payload = {
        ...formData,
        businessVerification,
        isPrototypeTester,
        submittedAt: new Date().toISOString(),
      };

      return apiRequest('/api/invite/specialized-contact', {
        method: 'POST',
        body: payload,
      });
    },
    onSuccess: () => {
      setCurrentStep(4);
    },
    onError: () => {
      setFormError('Kunne ikke sende inn søknaden. Prøv igjen.');
    },
  });

  const handleClose = (): void => {
    if (submitInviteMutation.isPending) return;
    onClose();
  };

  const requiredFieldsByStep: Array<Array<keyof InviteFormData>> = [
    ['businessName', 'orgNumber', 'profession'],
    ['contactName', 'contactEmail', 'contactPhone'],
    ['businessDescription', 'currentChallenges', 'whyCreatorHub', 'teamSize'],
    ['acceptTerms', 'acceptGoogleIntegration'],
  ];

  const handleNext = async (): Promise<void> => {
    if (currentStep === 0 && !businessVerification?.success) {
      setFormError('Verifiser bedriften før du går videre.');
      return;
    }

    const fieldsToValidate = requiredFieldsByStep[currentStep] || [];
    const valid = await trigger(fieldsToValidate);
    if (!valid) return;

    setFormError(null);
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = (): void => {
    setFormError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const onSubmit = async (formData: InviteFormData): Promise<void> => {
    const elapsedMs = Date.now() - formStartedAt.current;
    if (formData.website_url_trap && formData.website_url_trap.trim().length > 0) {
      setFormError('Bot-beskyttelse trigget.');
      return;
    }
    if (elapsedMs < 3000) {
      setFormError('Skjema ble sendt for raskt. Verifiser informasjonen og prøv igjen.');
      return;
    }

    await submitInviteMutation.mutateAsync(formData);
  };

  if (professionsLoading && open) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogContent sx={{ py: 5, textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Laster profesjoner...</Typography>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box component="img" src={logoCreatorHub} alt="CreatorHub" sx={{ width: 38, height: 38 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Specialized Contact
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Søknad om profesjonell onboarding i CreatorHub Norge
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Stepper activeStep={currentStep} sx={{ mb: 3 }} alternativeLabel>
          {stepLabels.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {formError ? <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert> : null}

        {currentStep === 0 ? (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Alert severity="info" icon={<BusinessIcon />}>
                Verifiser organisasjonsnummer med BRREG før videre onboarding.
              </Alert>
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="orgNumber"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Organisasjonsnummer"
                    fullWidth
                    error={Boolean(errors.orgNumber)}
                    helperText={errors.orgNumber?.message}
                    inputProps={{ maxLength: 9 }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={Boolean(errors.profession)}>
                <InputLabel id="profession-label">Profesjon</InputLabel>
                <Controller
                  name="profession"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} labelId="profession-label" label="Profesjon">
                      {professionOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="businessName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Bedriftsnavn"
                    fullWidth
                    error={Boolean(errors.businessName)}
                    helperText={errors.businessName?.message}
                    onFocus={() => setShowSuggestions(searchSuggestions.length > 0)}
                    onBlur={() => {
                      window.setTimeout(() => setShowSuggestions(false), 180);
                    }}
                  />
                )}
              />

              {showSuggestions && searchSuggestions.length > 0 ? (
                <Paper variant="outlined" sx={{ mt: 1 }}>
                  <List dense>
                    {searchSuggestions.map((suggestion) => (
                      <Button
                        key={`${suggestion.orgNumber}-${suggestion.name}`}
                        fullWidth
                        sx={{ justifyContent: 'flex-start', px: 2, py: 1.2, textTransform: 'none' }}
                        onClick={() => {
                          setValue('businessName', suggestion.name, { shouldValidate: true });
                          setValue('orgNumber', suggestion.orgNumber, { shouldValidate: true });
                          setShowSuggestions(false);
                        }}
                        startIcon={<SearchIcon />}
                      >
                        <Box sx={{ textAlign: 'left' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {suggestion.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {suggestion.orgNumber} · {suggestion.businessType}
                          </Typography>
                        </Box>
                      </Button>
                    ))}
                  </List>
                </Paper>
              ) : null}
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="contained"
                startIcon={verificationLoading ? <CircularProgress size={16} color="inherit" /> : <VerifiedIcon />}
                onClick={() => void verifyBusiness(orgNumber)}
                disabled={orgNumber.length !== 9 || verificationLoading}
              >
                Verifiser bedrift
              </Button>
            </Grid>

            {businessVerification ? (
              <Grid item xs={12}>
                <Alert
                  severity={businessVerification.success ? 'success' : 'warning'}
                  icon={businessVerification.success ? <CheckCircleIcon /> : <WarningIcon />}
                >
                  {businessVerification.success
                    ? `Verifisert: ${businessVerification.businessInfo?.displayName}`
                    : businessVerification.message}
                </Alert>

                {businessVerification.success && businessVerification.businessInfo ? (
                  <Card variant="outlined" sx={{ mt: 1.5 }}>
                    <CardContent>
                      <Grid container spacing={1}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" color="text.secondary">Adresse</Typography>
                          <Typography variant="body2">{businessVerification.businessInfo.address}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" color="text.secondary">Organisasjonsform</Typography>
                          <Typography variant="body2">{businessVerification.businessInfo.businessType}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" color="text.secondary">Stiftet</Typography>
                          <Typography variant="body2">{businessVerification.businessInfo.foundingYear}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" color="text.secondary">Ansatte</Typography>
                          <Typography variant="body2">{businessVerification.businessInfo.employeeCount}</Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ) : null}
              </Grid>
            ) : null}
          </Grid>
        ) : null}

        {currentStep === 1 ? (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Alert severity="info" icon={<SecurityIcon />}>
                Kontaktinformasjon for sikker onboarding og tilgangskontroll.
              </Alert>
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="contactName"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Kontaktperson" fullWidth error={Boolean(errors.contactName)} helperText={errors.contactName?.message} />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="contactPhone"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Telefon" fullWidth error={Boolean(errors.contactPhone)} helperText={errors.contactPhone?.message} />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="contactEmail"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="E-post" fullWidth error={Boolean(errors.contactEmail)} helperText={errors.contactEmail?.message} />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="specialization"
                control={control}
                render={({ field }) => <TextField {...field} label="Spesialisering" fullWidth />}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="teamSize"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Teamstørrelse"
                    fullWidth
                    inputProps={{ min: 1 }}
                    onChange={(event) => field.onChange(Number(event.target.value))}
                    error={Boolean(errors.teamSize)}
                    helperText={errors.teamSize?.message}
                  />
                )}
              />
            </Grid>
          </Grid>
        ) : null}

        {currentStep === 2 ? (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Alert severity="info" icon={<AssessmentIcon />}>
                Beskriv behov og utfordringer for å få riktig oppsett.
              </Alert>
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="businessDescription"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Bedriftsbeskrivelse"
                    fullWidth
                    multiline
                    minRows={3}
                    error={Boolean(errors.businessDescription)}
                    helperText={errors.businessDescription?.message}
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
                    label="Nåværende utfordringer"
                    fullWidth
                    multiline
                    minRows={2}
                    error={Boolean(errors.currentChallenges)}
                    helperText={errors.currentChallenges?.message}
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
                    label="Hvorfor CreatorHub Norge?"
                    fullWidth
                    multiline
                    minRows={2}
                    error={Boolean(errors.whyCreatorHub)}
                    helperText={errors.whyCreatorHub?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="annualRevenue"
                control={control}
                render={({ field }) => <TextField {...field} label="Årlig omsetning (valgfritt)" fullWidth />}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="websiteUrl"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Nettside (valgfritt)" fullWidth error={Boolean(errors.websiteUrl)} helperText={errors.websiteUrl?.message} />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="hasGoogleWorkspace"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} icon={<GoogleIcon />} checkedIcon={<CloudDoneIcon />} />}
                    label="Vi bruker Google Workspace"
                  />
                )}
              />
            </Grid>

            {hasGoogleWorkspace ? (
              <Grid item xs={12}>
                <Controller
                  name="googleWorkspaceEmail"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Google Workspace admin e-post"
                      fullWidth
                      error={Boolean(errors.googleWorkspaceEmail)}
                      helperText={errors.googleWorkspaceEmail?.message}
                    />
                  )}
                />
              </Grid>
            ) : null}

            <Grid item xs={12}>
              <FormControlLabel
                control={<Checkbox checked={isPrototypeTester} onChange={(event) => setIsPrototypeTester(event.target.checked)} />}
                label="Jeg ønsker også tilgang som prototype-tester"
              />
              {isPrototypeTester ? (
                <Button variant="outlined" size="small" onClick={() => setShowPrototypeTesterModal(true)}>
                  Åpne prototype-tester info
                </Button>
              ) : null}
            </Grid>
          </Grid>
        ) : null}

        {currentStep === 3 ? (
          <Box>
            <Alert severity="success" icon={<VerifiedIcon />} sx={{ mb: 2 }}>
              Kontroller informasjonen før innsending.
            </Alert>

            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={1}>
                <Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">Bedrift</Typography><Typography>{getValues('businessName')}</Typography></Grid>
                <Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">Org.nr</Typography><Typography>{getValues('orgNumber')}</Typography></Grid>
                <Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">Kontakt</Typography><Typography>{getValues('contactName')}</Typography></Grid>
                <Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">E-post</Typography><Typography>{getValues('contactEmail')}</Typography></Grid>
                <Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">Profesjon</Typography><Typography>{professionOptions.find((option) => option.value === profession)?.label || profession}</Typography></Grid>
                <Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">Google Workspace</Typography><Typography>{hasGoogleWorkspace ? 'Ja' : 'Nei'}</Typography></Grid>
              </Grid>
            </Paper>

            <Controller
              name="acceptTerms"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                  label="Jeg godtar vilkår og personvern for onboarding"
                />
              )}
            />
            {errors.acceptTerms ? <Typography color="error" variant="caption">{errors.acceptTerms.message}</Typography> : null}

            <Controller
              name="acceptGoogleIntegration"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                  label="Jeg godkjenner nødvendige API-integrasjoner for onboarding"
                />
              )}
            />
          </Box>
        ) : null}

        {currentStep === 4 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 1 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              Søknad sendt
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Vi har mottatt søknaden din og kontakter deg med neste steg.
            </Typography>
            <Chip icon={<SecurityIcon />} label="Status: Under gjennomgang" color="success" variant="outlined" />
          </Box>
        ) : null}
      </DialogContent>

      {currentStep < 4 ? (
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button onClick={currentStep === 0 ? handleClose : handleBack} disabled={submitInviteMutation.isPending}>
            {currentStep === 0 ? 'Avbryt' : 'Tilbake'}
          </Button>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {currentStep < 3 ? (
              <Button variant="contained" onClick={() => void handleNext()}>
                Neste
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={() => void handleSubmit(onSubmit)()}
                disabled={!isValid || submitInviteMutation.isPending}
                startIcon={submitInviteMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <VerifiedIcon />}
              >
                Send søknad
              </Button>
            )}
          </Box>
        </DialogActions>
      ) : (
        <DialogActions>
          <Button variant="contained" onClick={handleClose}>Lukk</Button>
        </DialogActions>
      )}

      <PrototypeTesterModal open={showPrototypeTesterModal} onClose={() => setShowPrototypeTesterModal(false)} />

      <Box component="input" type="text" sx={{ display: 'none' }} {...register('website_url_trap')} />
    </Dialog>
  );
}
