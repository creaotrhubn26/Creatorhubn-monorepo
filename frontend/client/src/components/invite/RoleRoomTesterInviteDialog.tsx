/**
 * PrototypeTesterInviteDialog — CreatorHub-adminflate for å invitere
 * prototype-testere direkte (push-modell), i tillegg til den eksisterende
 * pull-modellen (testere søker, admin godkjenner).
 *
 * Workflow:
 *  1. Admin fyller inn epost + navn + valgte testområder
 *  2. Submit → backend genererer one-time-link og sender invitasjons-e-post
 *  3. Tester mottar lenken og godtar hele avtalegrunnlaget
 *  4. CreatorHub oppretter konto og solo_pro-tilgang
 *
 * Backend-API som forventes:
 *   POST /api/prototype-tester-invites
 *     body: { email, name, profession, company, organizationNumber,
 *             testingAreas, personalMessage }
 *     returns: { id, token, inviteUrl, emailDelivery }
 */

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Autocomplete,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  FormHelperText,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Send as SendIcon,
  ContentCopy as CopyIcon,
  Business as BusinessIcon,
  Search as SearchIcon,
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

interface PrototypeTesterInviteDialogProps {
  open: boolean;
  onClose: () => void;
  /** Endepunkt for å opprette en invitasjon. Default: CreatorHub-programmet. */
  endpoint?: string;
}

interface InviteResponse {
  id: string;
  token: string;
  inviteUrl: string;
  emailDelivery?: {
    sent: boolean;
    provider?: string | null;
    reason?: string | null;
    messageId?: string | null;
  } | null;
  verifiedCompany?: {
    name: string;
    organizationNumber: string;
    businessAddress?: string | null;
  } | null;
}

interface BrregCompanyOption {
  organizationNumber: string;
  name: string;
  organizationForm: string | null;
  primaryIndustryCode: string | null;
  primaryIndustryDescription: string | null;
  recommendedProfession: (typeof PROFESSION_OPTIONS)[number]['value'] | null;
  businessAddress: string | null;
  operationalStatus: 'active' | 'inactive' | 'bankruptcy' | 'liquidation';
}

export const PrototypeTesterInviteDialog = ({
  open,
  onClose,
  endpoint = '/api/prototype-tester-invites',
}: PrototypeTesterInviteDialogProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profession, setProfession] = useState('');
  const [autoSuggestedProfession, setAutoSuggestedProfession] = useState<string | null>(null);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyOptions, setCompanyOptions] = useState<BrregCompanyOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<BrregCompanyOption | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companySearchError, setCompanySearchError] = useState<string | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [personalMessage, setPersonalMessage] = useState('');
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
      void apiRequest(
        `/api/prototype-tester-invites/brreg/search?q=${encodeURIComponent(term)}`,
      )
        .then((data) => {
          if (cancelled) return;
          setCompanyOptions(Array.isArray(data?.companies) ? data.companies : []);
        })
        .catch(() => {
          if (cancelled) return;
          setCompanyOptions([]);
          setCompanySearchError('BRREG-søket er midlertidig utilgjengelig. Prøv igjen.');
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

  const reset = () => {
    setName('');
    setEmail('');
    setProfession('');
    setAutoSuggestedProfession(null);
    setCompanyQuery('');
    setCompanyOptions([]);
    setSelectedCompany(null);
    setCompanyLoading(false);
    setCompanySearchError(null);
    setSelectedAreas([]);
    setPersonalMessage('');
    setError(null);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleArea = (area: string) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  };

  const canSubmit =
    name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    (!companyQuery.trim() || Boolean(selectedCompany)) &&
    selectedAreas.length > 0 &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: {
          email: email.trim(),
          name: name.trim(),
          profession: profession.trim() || undefined,
          company: selectedCompany?.name,
          organizationNumber: selectedCompany?.organizationNumber,
          testingAreas: selectedAreas,
          personalMessage: personalMessage.trim() || undefined,
        },
      });
      if (!data?.id || !data?.token || !data?.inviteUrl) {
        throw new Error('Invitasjonen ble ikke opprettet med en gyldig lenke.');
      }
      setResult(data as InviteResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukjent feil');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (result?.inviteUrl) {
      try {
        await navigator.clipboard.writeText(result.inviteUrl);
      } catch {
        /* fail silent — bruker kan bare lese URL-en */
      }
    }
  };

  return (
    <ThemeProvider theme={workspaceDarkTheme}>
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: ws.panelSolid,
          color: ws.text,
          border: `1px solid ${ws.border}`,
          backgroundImage: 'none',
          boxShadow: '0 28px 80px rgba(0,0,0,0.5)',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ color: ws.text, fontWeight: 800 }}>
            Inviter prototype-tester
          </Typography>
          <Typography variant="caption" sx={{ color: ws.textDim }}>
            Sender en 14-dagers lenke med programvilkår, NDA, databehandleravtale og intensjonsavtale.
          </Typography>
        </Box>
        <IconButton onClick={handleClose} aria-label="Lukk" sx={{ color: ws.textDim }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: ws.border }}>
        {result ? (
          <Stack spacing={2}>
            <Alert
              severity={result.emailDelivery?.sent ? 'success' : 'warning'}
              variant="outlined"
            >
              {result.emailDelivery?.sent
                ? `Invitasjon opprettet og e-post sendt til ${email}.`
                : `Invitasjonen er opprettet, men e-posten ble ikke bekreftet sendt${result.emailDelivery?.reason ? `: ${result.emailDelivery.reason}` : '.'}`}
            </Alert>
            {result.verifiedCompany && (
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: ws.greenSoft,
                  border: '1px solid rgba(52,211,153,0.38)',
                  borderRadius: 1.5,
                }}
              >
                <Typography variant="body2" sx={{ color: ws.text, fontWeight: 800 }}>
                  {result.verifiedCompany.name}
                </Typography>
                <Typography variant="caption" sx={{ color: ws.textDim, display: 'block' }}>
                  BRREG-verifisert · Org.nr. {result.verifiedCompany.organizationNumber}
                  {result.verifiedCompany.businessAddress
                    ? ` · ${result.verifiedCompany.businessAddress}`
                    : ''}
                </Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" sx={{ color: ws.textDim, mb: 0.5, display: 'block' }}>
                One-time-link (kopier og del manuelt om e-posten ikke kommer fram):
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.25,
                  bgcolor: ws.bg,
                  border: `1px solid ${ws.border}`,
                  borderRadius: 1,
                }}
              >
                <Typography sx={{ flex: 1, fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all' }}>
                  {result.inviteUrl}
                </Typography>
                <IconButton
                  onClick={handleCopyLink}
                  aria-label="Kopier link"
                  size="small"
                  sx={{ color: ws.accent }}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <TextField
              label="Navn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
              autoFocus
              InputProps={{ sx: { bgcolor: ws.panelInput } }}
            />
            <TextField
              label="E-post"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              size="small"
              InputProps={{ sx: { bgcolor: ws.panelInput } }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="prototype-tester-profession-label">
                  Profesjon (valgfri)
                </InputLabel>
                <Select
                  id="prototype-tester-profession"
                  labelId="prototype-tester-profession-label"
                  label="Profesjon (valgfri)"
                  value={profession}
                  onChange={(e) => {
                    setProfession(e.target.value);
                    setAutoSuggestedProfession(null);
                  }}
                  sx={{ bgcolor: ws.panelInput }}
                >
                  <MenuItem value=""><em>Ikke valgt</em></MenuItem>
                  {PROFESSION_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Autocomplete
                fullWidth
                options={companyOptions}
                value={selectedCompany}
                inputValue={companyQuery}
                loading={companyLoading}
                filterOptions={(options) => options}
                isOptionEqualToValue={(option, value) =>
                  option.organizationNumber === value.organizationNumber
                }
                getOptionLabel={(option) => option.name}
                onInputChange={(_, nextValue, reason) => {
                  setCompanyQuery(nextValue);
                  if (reason === 'clear') setSelectedCompany(null);
                  if (
                    reason === 'input' &&
                    selectedCompany &&
                    nextValue !== selectedCompany.name
                  ) {
                    setSelectedCompany(null);
                    if (autoSuggestedProfession) {
                      setProfession('');
                      setAutoSuggestedProfession(null);
                    }
                  }
                }}
                onChange={(_, option) => {
                  setSelectedCompany(option);
                  setCompanyQuery(option?.name || '');
                  setCompanySearchError(null);
                  if (
                    option?.recommendedProfession &&
                    (!profession || Boolean(autoSuggestedProfession))
                  ) {
                    setProfession(option.recommendedProfession);
                    setAutoSuggestedProfession(option.recommendedProfession);
                  } else if (!option?.recommendedProfession && autoSuggestedProfession) {
                    setProfession('');
                    setAutoSuggestedProfession(null);
                  }
                }}
                renderOption={(props, option) => (
                  <Box component="li" {...props} key={option.organizationNumber}>
                    <BusinessIcon sx={{ color: ws.accent, mr: 1.25, flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ color: ws.text, fontWeight: 700 }}>
                        {option.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: ws.textDim }}>
                        Org.nr. {option.organizationNumber}
                        {option.organizationForm ? ` · ${option.organizationForm}` : ''}
                      </Typography>
                      {option.primaryIndustryDescription && (
                        <Typography variant="caption" sx={{ color: ws.textDim, display: 'block' }}>
                          {option.primaryIndustryCode
                            ? `${option.primaryIndustryCode} · `
                            : ''}
                          {option.primaryIndustryDescription}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                noOptionsText={
                  companyQuery.trim().length < 2
                    ? 'Skriv minst to tegn'
                    : 'Ingen virksomheter funnet'
                }
                loadingText="Søker i Brønnøysundregistrene…"
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Søk bedrift i Brønnøysundregistrene"
                    placeholder="Navn eller 9-sifret org.nr."
                    size="small"
                    error={Boolean(companySearchError)}
                    helperText={
                      companySearchError ||
                      (companyQuery.trim() && !selectedCompany
                        ? 'Velg en virksomhet fra trefflisten for å bruke den i avtalene.'
                        : 'Valgfritt. Juridisk navn og org.nr. hentes fra BRREG.')
                    }
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: ws.textDim }} />
                        </InputAdornment>
                      ),
                      sx: { bgcolor: ws.panelInput },
                    }}
                  />
                )}
              />
            </Stack>
            {selectedCompany?.recommendedProfession && (
              <FormHelperText sx={{ mt: -1.25, color: ws.textDim }}>
                BRREG foreslår «
                {PROFESSION_OPTIONS.find(
                  (option) => option.value === selectedCompany.recommendedProfession,
                )?.label}
                » basert på næringskode
                {selectedCompany.primaryIndustryCode
                  ? ` ${selectedCompany.primaryIndustryCode}`
                  : ''}
                . Du kan endre valget.
              </FormHelperText>
            )}
            {selectedCompany && (
              <Box
                role="status"
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.25,
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: ws.greenSoft,
                  border: '1px solid rgba(52,211,153,0.38)',
                }}
              >
                <BusinessIcon sx={{ color: ws.green, mt: 0.1 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: ws.text, fontWeight: 800 }}>
                    {selectedCompany.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: ws.textDim, display: 'block' }}>
                    BRREG-verifisert · Org.nr. {selectedCompany.organizationNumber}
                  </Typography>
                  {selectedCompany.businessAddress && (
                    <Typography variant="caption" sx={{ color: ws.textDim, display: 'block' }}>
                      {selectedCompany.businessAddress}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
            <Box>
              <Typography variant="caption" sx={{ color: ws.textDim, display: 'block', mb: 1 }}>
                Områder å teste (velg minst ett)
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {DEFAULT_TESTING_AREAS.map((area) => {
                  const isSelected = selectedAreas.includes(area);
                  return (
                    <Chip
                      key={area}
                      label={area}
                      onClick={() => toggleArea(area)}
                      sx={{
                        bgcolor: isSelected ? ws.accentSoft : ws.panelInput,
                        color: isSelected ? ws.accent : ws.textDim,
                        border: `1px solid ${isSelected ? ws.accentBorder : ws.border}`,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    />
                  );
                })}
              </Stack>
            </Box>
            <TextField
              label="Personlig melding (valgfri)"
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
              placeholder="Hei! Vi vil gjerne invitere deg til CreatorHubs prototypeprogram …"
              InputProps={{ sx: { bgcolor: ws.panelInput } }}
            />
            {error && <Alert severity="error" variant="outlined">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {result ? (
          <Button variant="contained" onClick={handleClose}>Ferdig</Button>
        ) : (
          <>
            <Button onClick={handleClose} sx={{ color: ws.textDim }}>
              Avbryt
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!canSubmit}
              startIcon={submitting ? <CircularProgress size={16} /> : <SendIcon />}
              sx={{
                bgcolor: ws.accent,
                color: ws.accentContrast,
                fontWeight: 800,
                '&:hover': { bgcolor: ws.accentHover },
              }}
            >
              {submitting ? 'Sender…' : 'Send invitasjon'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
    </ThemeProvider>
  );
};

// Bakoverkompatibelt eksportnavn mens eldre imports fases ut.
export const RoleRoomTesterInviteDialog = PrototypeTesterInviteDialog;

export default PrototypeTesterInviteDialog;
