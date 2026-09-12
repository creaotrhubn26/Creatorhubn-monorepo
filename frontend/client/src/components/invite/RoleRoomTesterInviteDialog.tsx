import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Business as BusinessIcon,
  CheckCircleOutline as CheckIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  PersonSearch as PersonSearchIcon,
  Search as SearchIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { ws, workspaceDarkTheme } from '@/components/workspace/workspaceTheme';

const DEFAULT_TESTING_AREAS = [
  'CreatorHub-dashboard',
  'Story Arc Studio',
  'Prosjekt og arbeidsflyt',
  'Showcase og klient-godkjenning',
  'Kontrakt og fakturering',
  'Integrasjoner',
  'Mobil',
  'iPad',
];

const PROFESSION_OPTIONS = [
  { value: 'photographer', label: 'Fotograf' },
  { value: 'videographer', label: 'Videograf' },
  { value: 'music_producer', label: 'Musikkprodusent' },
  { value: 'vendor', label: 'Leverandør' },
] as const;

type ProfessionValue = (typeof PROFESSION_OPTIONS)[number]['value'];

const PROFESSION_AREA_SUGGESTIONS: Record<ProfessionValue, string[]> = {
  photographer: ['CreatorHub-dashboard', 'Prosjekt og arbeidsflyt', 'Showcase og klient-godkjenning', 'Kontrakt og fakturering', 'Mobil', 'iPad'],
  videographer: ['CreatorHub-dashboard', 'Story Arc Studio', 'Prosjekt og arbeidsflyt', 'Showcase og klient-godkjenning', 'Mobil'],
  music_producer: ['CreatorHub-dashboard', 'Prosjekt og arbeidsflyt', 'Showcase og klient-godkjenning', 'Kontrakt og fakturering', 'Integrasjoner'],
  vendor: ['CreatorHub-dashboard', 'Prosjekt og arbeidsflyt', 'Kontrakt og fakturering', 'Integrasjoner'],
};

interface PrototypeTesterInviteDialogProps {
  open: boolean;
  onClose: () => void;
  endpoint?: string;
}

interface InviteResponse {
  id: string;
  token: string;
  inviteUrl: string;
  emailDelivery?: { sent: boolean; provider?: string | null; reason?: string | null; messageId?: string | null } | null;
  verifiedCompany?: { name: string; organizationNumber: string; businessAddress?: string | null } | null;
}

interface InvitePreview {
  subject: string;
  html: string;
  text: string;
  fromLabel: string;
  fromAddress: string;
  replyToEmail: string;
  recipientEmail: string;
  expiresAt: string;
  agreements: string[];
}

interface BrregCompanyOption {
  organizationNumber: string;
  name: string;
  organizationForm: string | null;
  organizationFormCode: string | null;
  primaryIndustryCode: string | null;
  primaryIndustryDescription: string | null;
  recommendedProfession: ProfessionValue | null;
  professionRecommendation?: { profession: ProfessionValue; confidence: 'high' | 'medium'; reason: string } | null;
  suggestedTestingAreas?: string[];
  businessAddress: string | null;
  operationalStatus: 'active' | 'inactive' | 'bankruptcy' | 'liquidation';
}

interface BrregContactSuggestion {
  name: string;
  role: string;
  source: 'BRREG_ROLLER';
  requiresConfirmation: true;
}

const fieldSx = { bgcolor: ws.panelInput } as const;

function professionLabel(value: string) {
  return PROFESSION_OPTIONS.find((option) => option.value === value)?.label || value;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '14 dager etter utsending'
    : new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export const PrototypeTesterInviteDialog = ({ open, onClose, endpoint = '/api/prototype-tester-invites' }: PrototypeTesterInviteDialogProps) => {
  const [activeStep, setActiveStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profession, setProfession] = useState('');
  const [autoSuggestedProfession, setAutoSuggestedProfession] = useState<string | null>(null);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyOptions, setCompanyOptions] = useState<BrregCompanyOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<BrregCompanyOption | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companySearchError, setCompanySearchError] = useState<string | null>(null);
  const [contactSuggestion, setContactSuggestion] = useState<BrregContactSuggestion | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [personalMessage, setPersonalMessage] = useState('');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    const term = companyQuery.trim();
    if (selectedCompany?.name === term || term.length < 2) {
      setCompanyOptions([]);
      setCompanyLoading(false);
      setCompanySearchError(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setCompanyLoading(true);
      setCompanySearchError(null);
      void apiRequest(`/api/prototype-tester-invites/brreg/search?q=${encodeURIComponent(term)}`)
        .then((data) => {
          if (!cancelled) setCompanyOptions(Array.isArray(data?.companies) ? data.companies : []);
        })
        .catch(() => {
          if (!cancelled) {
            setCompanyOptions([]);
            setCompanySearchError('BRREG-søket er midlertidig utilgjengelig. Prøv igjen.');
          }
        })
        .finally(() => {
          if (!cancelled) setCompanyLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [companyQuery, open, selectedCompany]);

  useEffect(() => {
    setContactSuggestion(null);
    if (!selectedCompany || selectedCompany.organizationFormCode !== 'ENK') return;
    let cancelled = false;
    setContactLoading(true);
    void apiRequest(`/api/prototype-tester-invites/brreg/${encodeURIComponent(selectedCompany.organizationNumber)}/contact`)
      .then((data) => {
        if (!cancelled) setContactSuggestion(data?.contact || null);
      })
      .catch(() => {
        if (!cancelled) setContactSuggestion(null);
      })
      .finally(() => {
        if (!cancelled) setContactLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCompany]);

  const reset = () => {
    setActiveStep(0);
    setName('');
    setEmail('');
    setProfession('');
    setAutoSuggestedProfession(null);
    setCompanyQuery('');
    setCompanyOptions([]);
    setSelectedCompany(null);
    setCompanyLoading(false);
    setCompanySearchError(null);
    setContactSuggestion(null);
    setContactLoading(false);
    setSelectedAreas([]);
    setPersonalMessage('');
    setPreview(null);
    setPreviewLoading(false);
    setSubmitting(false);
    setError(null);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const payload = useMemo(() => ({
    email: email.trim(),
    name: name.trim(),
    profession: profession || undefined,
    company: selectedCompany?.name,
    organizationNumber: selectedCompany?.organizationNumber,
    testingAreas: selectedAreas,
    personalMessage: personalMessage.trim() || undefined,
  }), [email, name, personalMessage, profession, selectedAreas, selectedCompany]);

  const missingRequirements = useMemo(() => {
    const missing: string[] = [];
    if (name.trim().length < 2) missing.push('kontaktpersonens navn');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) missing.push('gyldig e-postadresse');
    if (companyQuery.trim() && !selectedCompany) missing.push('valgt BRREG-treff eller tømt bedriftsfelt');
    if (!profession) missing.push('profesjon');
    if (selectedAreas.length === 0) missing.push('minst ett testområde');
    return missing;
  }, [companyQuery, email, name, profession, selectedAreas.length, selectedCompany]);

  const suggestedAreas = selectedCompany?.suggestedTestingAreas?.length
    ? selectedCompany.suggestedTestingAreas
    : profession
      ? PROFESSION_AREA_SUGGESTIONS[profession as ProfessionValue] || []
      : [];

  const chooseCompany = (option: BrregCompanyOption | null) => {
    setSelectedCompany(option);
    setCompanyQuery(option?.name || '');
    setCompanySearchError(null);
    setPreview(null);
    if (option?.recommendedProfession && (!profession || autoSuggestedProfession)) {
      setProfession(option.recommendedProfession);
      setAutoSuggestedProfession(option.recommendedProfession);
    } else if (!option?.recommendedProfession && autoSuggestedProfession) {
      setProfession('');
      setAutoSuggestedProfession(null);
    }
  };

  const toggleArea = (area: string) => {
    setSelectedAreas((previous) => previous.includes(area) ? previous.filter((entry) => entry !== area) : [...previous, area]);
    setPreview(null);
  };

  const openPreview = async () => {
    if (missingRequirements.length) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`${endpoint}/preview`, { method: 'POST', body: payload });
      if (!data?.subject || !data?.html || !data?.text) throw new Error('E-postmalen kunne ikke forhåndsvises.');
      setPreview(data as InvitePreview);
      setActiveStep(2);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kunne ikke lage forhåndsvisning.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (missingRequirements.length || !preview) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiRequest(endpoint, { method: 'POST', body: payload });
      if (!data?.id || !data?.token || !data?.inviteUrl) throw new Error('Invitasjonen ble ikke opprettet med en gyldig lenke.');
      setResult(data as InviteResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ukjent feil');
    } finally {
      setSubmitting(false);
    }
  };

  const copyInviteLink = async () => {
    if (result?.inviteUrl) await navigator.clipboard.writeText(result.inviteUrl).catch(() => undefined);
  };

  return (
    <ThemeProvider theme={workspaceDarkTheme}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}`, backgroundImage: 'none', boxShadow: '0 28px 80px rgba(0,0,0,0.5)', maxHeight: '92vh' } }}
      >
        <DialogTitle sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 2 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
            <Box>
              <Typography component="span" variant="h5" sx={{ color: ws.text, display: 'block', fontWeight: 850 }}>Inviter prototype-tester</Typography>
              <Typography variant="body2" sx={{ color: ws.textDim, mt: 0.5 }}>BRREG-verifisert bedrift, kontrollert e-postmal og fire dokumenter.</Typography>
            </Box>
            <IconButton onClick={handleClose} aria-label="Lukk" sx={{ color: ws.textDim }}><CloseIcon /></IconButton>
          </Stack>
          {!result && (
            <Stepper activeStep={activeStep} sx={{ mt: 2.5 }}>
              {['Bedrift', 'Kontakt og test', 'Kontroll'].map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>
          )}
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: ws.border, px: { xs: 2, sm: 3 }, py: 3 }}>
          {result ? (
            <Stack spacing={2.5}>
              <Alert severity={result.emailDelivery?.sent ? 'success' : 'warning'} variant="outlined">
                {result.emailDelivery?.sent
                  ? `Invitasjon opprettet og e-post sendt til ${email}.`
                  : `Invitasjonen er opprettet, men e-posten ble ikke bekreftet sendt${result.emailDelivery?.reason ? `: ${result.emailDelivery.reason}` : '.'}`}
              </Alert>
              {result.verifiedCompany && (
                <Box sx={{ p: 2, bgcolor: ws.greenSoft, border: '1px solid rgba(52,211,153,0.38)', borderRadius: 2 }}>
                  <Typography sx={{ color: ws.text, fontWeight: 800 }}>{result.verifiedCompany.name}</Typography>
                  <Typography variant="caption" sx={{ color: ws.textDim }}>BRREG-verifisert · Org.nr. {result.verifiedCompany.organizationNumber}{result.verifiedCompany.businessAddress ? ` · ${result.verifiedCompany.businessAddress}` : ''}</Typography>
                </Box>
              )}
              <Box sx={{ p: 2, bgcolor: ws.bg, border: `1px solid ${ws.border}`, borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: ws.textDim }}>RESERVELENKE</Typography>
                <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 0.75 }}>
                  <Typography sx={{ flex: 1, fontFamily: 'monospace', fontSize: '0.78rem', overflowWrap: 'anywhere' }}>{result.inviteUrl}</Typography>
                  <IconButton onClick={copyInviteLink} aria-label="Kopier lenke" size="small" sx={{ color: ws.accent }}><CopyIcon fontSize="small" /></IconButton>
                </Stack>
              </Box>
            </Stack>
          ) : (
            <Stack spacing={2.5}>
              {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

              {activeStep === 0 && (
                <Stack spacing={2.25}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>1. Virksomhet</Typography>
                    <Typography variant="body2" sx={{ color: ws.textDim, mt: 0.5 }}>Søk etter juridisk navn eller organisasjonsnummer. Bedrift er valgfritt.</Typography>
                  </Box>
                  <Autocomplete
                    fullWidth
                    options={companyOptions}
                    value={selectedCompany}
                    inputValue={companyQuery}
                    loading={companyLoading}
                    filterOptions={(options) => options}
                    isOptionEqualToValue={(option, value) => option.organizationNumber === value.organizationNumber}
                    getOptionLabel={(option) => option.name}
                    onInputChange={(_, nextValue, reason) => {
                      setCompanyQuery(nextValue);
                      if (reason === 'clear' || (reason === 'input' && selectedCompany && nextValue !== selectedCompany.name)) {
                        setSelectedCompany(null);
                        setPreview(null);
                        if (autoSuggestedProfession) {
                          setProfession('');
                          setAutoSuggestedProfession(null);
                        }
                      }
                    }}
                    onChange={(_, option) => chooseCompany(option)}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} key={option.organizationNumber}>
                        <BusinessIcon sx={{ color: ws.accent, mr: 1.25, flexShrink: 0 }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 750 }}>{option.name}</Typography>
                          <Typography variant="caption" sx={{ color: ws.textDim }}>Org.nr. {option.organizationNumber}{option.organizationForm ? ` · ${option.organizationForm}` : ''}</Typography>
                          {option.primaryIndustryDescription && <Typography variant="caption" sx={{ color: ws.textDim, display: 'block' }}>{option.primaryIndustryCode ? `${option.primaryIndustryCode} · ` : ''}{option.primaryIndustryDescription}</Typography>}
                        </Box>
                      </Box>
                    )}
                    noOptionsText={companyQuery.trim().length < 2 ? 'Skriv minst to tegn' : 'Ingen aktive virksomheter funnet'}
                    loadingText="Søker i Brønnøysundregistrene…"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Søk bedrift i Brønnøysundregistrene"
                        placeholder="Estremo Records eller 998 989 159"
                        onChange={(event) => setCompanyQuery(event.target.value)}
                        error={Boolean(companySearchError || (companyQuery.trim() && !selectedCompany))}
                        helperText={companySearchError || (companyQuery.trim() && !selectedCompany ? 'Velg et aktivt BRREG-treff, eller tøm feltet for å fortsette uten bedrift.' : 'Juridisk navn, org.nr., adresse og næringskode hentes fra BRREG.')}
                        InputProps={{ ...params.InputProps, startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: ws.textDim }} /></InputAdornment>, sx: fieldSx }}
                      />
                    )}
                  />
                  {selectedCompany && (
                    <Box role="status" sx={{ p: 2, borderRadius: 2, bgcolor: ws.greenSoft, border: '1px solid rgba(52,211,153,0.38)' }}>
                      <Stack direction="row" gap={1.5} alignItems="flex-start">
                        <CheckIcon sx={{ color: ws.green }} />
                        <Box>
                          <Typography sx={{ fontWeight: 800 }}>{selectedCompany.name}</Typography>
                          <Typography variant="caption" sx={{ color: ws.textDim, display: 'block' }}>BRREG-verifisert · Org.nr. {selectedCompany.organizationNumber}</Typography>
                          {selectedCompany.businessAddress && <Typography variant="caption" sx={{ color: ws.textDim }}>{selectedCompany.businessAddress}</Typography>}
                        </Box>
                      </Stack>
                    </Box>
                  )}
                </Stack>
              )}

              {activeStep === 1 && (
                <Stack spacing={2.25}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>2. Kontakt og testopplegg</Typography>
                    <Typography variant="body2" sx={{ color: ws.textDim, mt: 0.5 }}>Kun e-post må alltid fylles manuelt. BRREG-forslag må bekreftes før de brukes.</Typography>
                  </Box>
                  {contactLoading && <Alert icon={<CircularProgress size={18} />} severity="info">Henter registrert innehaver fra BRREG…</Alert>}
                  {contactSuggestion && (
                    <Alert severity="info" icon={<PersonSearchIcon />} action={<Button color="inherit" size="small" onClick={() => { setName(contactSuggestion.name); setPreview(null); }}>Bruk navnet</Button>}>
                      BRREG foreslår {contactSuggestion.name} ({contactSuggestion.role}). Forslaget brukes først når du bekrefter.
                    </Alert>
                  )}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField label="Kontaktpersonens navn" value={name} onChange={(event) => { setName(event.target.value); setPreview(null); }} fullWidth autoFocus InputProps={{ sx: fieldSx }} />
                    <TextField label="E-post" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setPreview(null); }} fullWidth InputProps={{ sx: fieldSx }} />
                  </Stack>
                  <FormControl fullWidth>
                    <InputLabel id="prototype-tester-profession-label">Profesjon</InputLabel>
                    <Select
                      id="prototype-tester-profession"
                      labelId="prototype-tester-profession-label"
                      label="Profesjon"
                      value={profession}
                      onChange={(event) => { setProfession(event.target.value); setAutoSuggestedProfession(null); setPreview(null); }}
                      sx={fieldSx}
                    >
                      <MenuItem value=""><em>Velg profesjon</em></MenuItem>
                      {PROFESSION_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                    </Select>
                    {selectedCompany?.professionRecommendation && (
                      <FormHelperText sx={{ color: ws.textDim }}>{selectedCompany.professionRecommendation.confidence === 'high' ? 'Høy' : 'Middels'} sikkerhet: {selectedCompany.professionRecommendation.reason} Du kan overstyre.</FormHelperText>
                    )}
                  </FormControl>
                  <Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1} sx={{ mb: 1 }}>
                      <Typography variant="body2" sx={{ color: ws.textDim }}>Områder å teste (velg minst ett)</Typography>
                      {suggestedAreas.length > 0 && <Button size="small" onClick={() => { setSelectedAreas([...suggestedAreas]); setPreview(null); }}>Bruk {suggestedAreas.length} forslag for {professionLabel(profession)}</Button>}
                    </Stack>
                    <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
                      {DEFAULT_TESTING_AREAS.map((area) => {
                        const selected = selectedAreas.includes(area);
                        return <Chip key={area} label={area} onClick={() => toggleArea(area)} color={selected ? 'primary' : 'default'} variant={selected ? 'filled' : 'outlined'} sx={{ minHeight: 36, fontWeight: 700 }} />;
                      })}
                    </Stack>
                  </Box>
                  <TextField label="Personlig melding (valgfri)" value={personalMessage} onChange={(event) => { setPersonalMessage(event.target.value); setPreview(null); }} multiline minRows={3} inputProps={{ maxLength: 2000 }} helperText={`${personalMessage.length}/2000 tegn`} InputProps={{ sx: fieldSx }} />
                  {missingRequirements.length > 0 && <Alert severity="warning" variant="outlined" data-testid="invite-missing-requirements">Mangler før kontroll: {missingRequirements.join(', ')}.</Alert>}
                </Stack>
              )}

              {activeStep === 2 && preview && (
                <Stack spacing={2.25}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>3. Kontroller før utsending</Typography>
                    <Typography variant="body2" sx={{ color: ws.textDim, mt: 0.5 }}>Dette er den faktiske aktive Email Designer-malen. Ingen e-post er sendt ennå.</Typography>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 0.7fr) minmax(0, 1.3fr)' }, gap: 2 }}>
                    <Stack spacing={1.25}>
                      {[
                        ['Fra', `${preview.fromLabel} <${preview.fromAddress}>`], ['Til', preview.recipientEmail], ['Svar til', preview.replyToEmail], ['Emne', preview.subject], ['Bedrift', selectedCompany?.name || 'Ingen bedrift'], ['Profesjon', professionLabel(profession)], ['Testområder', selectedAreas.join(', ')], ['Avtaler', preview.agreements.join(', ')], ['Utløper', formatDate(preview.expiresAt)],
                      ].map(([label, value]) => (
                        <Box key={label} sx={{ p: 1.5, bgcolor: ws.panelInput, border: `1px solid ${ws.border}`, borderRadius: 1.5 }}>
                          <Typography variant="caption" sx={{ color: ws.textDim }}>{label.toUpperCase()}</Typography>
                          <Typography variant="body2" sx={{ mt: 0.35, overflowWrap: 'anywhere' }}>{value}</Typography>
                        </Box>
                      ))}
                    </Stack>
                    <Box component="iframe" title="Forhåndsvisning av invitasjons-e-post" sandbox="" srcDoc={preview.html} sx={{ width: '100%', minHeight: 640, border: `1px solid ${ws.border}`, borderRadius: 2, bgcolor: '#fff' }} />
                  </Box>
                  <Alert severity="info" variant="outlined">Utsendingen oppretter én 14-dagers lenke. Feil kan prøves på nytt fra adminpanelet uten å opprette en ny invitasjon.</Alert>
                </Stack>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, gap: 1, flexWrap: 'wrap' }}>
          {result ? (
            <Button variant="contained" onClick={handleClose}>Ferdig</Button>
          ) : (
            <>
              <Button onClick={handleClose} sx={{ color: ws.textDim }}>Avbryt</Button>
              <Box sx={{ flex: 1 }} />
              {activeStep > 0 && <Button startIcon={<ArrowBackIcon />} onClick={() => { setActiveStep((step) => step - 1); setError(null); }} sx={{ color: ws.textDim }}>Tilbake</Button>}
              {activeStep === 0 && <Button variant="contained" onClick={() => setActiveStep(1)} disabled={Boolean(companyQuery.trim() && !selectedCompany)}>{selectedCompany ? 'Fortsett med bedrift' : 'Fortsett uten bedrift'}</Button>}
              {activeStep === 1 && <Button variant="contained" onClick={() => void openPreview()} disabled={missingRequirements.length > 0 || previewLoading}>{previewLoading ? <CircularProgress size={20} /> : 'Se e-post og kontroller'}</Button>}
              {activeStep === 2 && <Button variant="contained" startIcon={submitting ? <CircularProgress size={18} /> : <SendIcon />} onClick={() => void handleSubmit()} disabled={submitting || !preview}>{submitting ? 'Sender…' : 'Send invitasjon'}</Button>}
            </>
          )}
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
};
