import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, TextField, MenuItem, Select, FormControl,
  InputLabel, Alert, Stepper, Step, StepLabel, Card,
  CardContent, CircularProgress, Chip, IconButton, Tooltip,
  ThemeProvider,
} from '@mui/material';
import {
  Business, PersonAdd, Payment, Email, Search as SearchIcon,
  CheckCircle, ArrowBack, Send, Close,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';
import { AdminButton, useIsMobile } from './design-system';
import { adminDarkTheme } from './adminDarkTheme';
import { ADMIN_EMAIL_DESIGNER_PRESETS } from './emailDesignerPresets';

interface BrregCompany {
  organisasjonsnummer: string;
  navn: string;
  forretningsadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
  };
  naeringskode1?: { kode?: string; beskrivelse?: string };
}

const INVITE_TEMPLATES = ADMIN_EMAIL_DESIGNER_PRESETS.filter((p) =>
  ['access-approved', 'welcome-sequence', 'partner-prototype-approved', 'enterprise-followup'].includes(p.id),
);

const PROFESSION_OPTIONS = [
  { value: 'photographer', label: 'Fotograf' },
  { value: 'videographer', label: 'Videograf' },
  { value: 'music_producer', label: 'Musikkprodusent' },
  { value: 'vendor', label: 'Leverand\u00f8r' },
  { value: 'editingvendor', label: 'Redigeringspartner' },
  { value: 'prototype_tester', label: 'Prototype-tester' },
];

const PLAN_OPTIONS = [
  { value: 'basic', label: 'Basic \u2013 249 kr/mnd', price: 249, color: '#4caf50' },
  { value: 'pro', label: 'Pro \u2013 449 kr/mnd', price: 449, color: '#ff8c00', popular: true },
  { value: 'enterprise', label: 'Enterprise \u2013 3 990 kr/mnd', price: 3990, color: '#1976d2' },
];

const STEPS = ['Bedrift', 'Kontakt', 'Abonnement', 'E-post'];

interface CreateInviteDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateInviteDialog({ open, onClose }: CreateInviteDialogProps) {
  const { auth } = useEnhancedMasterIntegration();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: rolesData } = useQuery<{ roles: { id: string; name: string; description: string }[] }>({
    queryKey: ['/api/admin/roles'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const r = await apiRequest('/api/admin/roles', { headers });
      return r as { roles: { id: string; name: string; description: string }[] };
    },
    enabled: open,
  });
  const roles = rolesData?.roles ?? [];

  const [step, setStep] = useState(0);
  const [brregSearch, setBrregSearch] = useState('');
  const [brregResults, setBrregResults] = useState<BrregCompany[]>([]);
  const [brregLoading, setBrregLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<BrregCompany | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profession, setProfession] = useState('');
  const [roleId, setRoleId] = useState('user');
  const [selectedPlan, setSelectedPlan] = useState('basic');
  const [templateId, setTemplateId] = useState('access-approved');
  const [personalMessage, setPersonalMessage] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const searchBrreg = useCallback(async (term: string) => {
    if (!term || term.length < 2) { setBrregResults([]); return; }
    setBrregLoading(true);
    try {
      const isOrgNr = /^\d+$/.test(term);
      const url = isOrgNr && term.length <= 9
        ? `https://data.brreg.no/enhetsregisteret/api/enheter?organisasjonsnummer=${term}*&size=10`
        : `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(term)}*&size=10`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('BRREG-s\u00f8k feilet');
      const data = await res.json();
      setBrregResults(data._embedded?.enheter || []);
    } catch {
      setBrregResults([]);
    } finally {
      setBrregLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (brregSearch) searchBrreg(brregSearch); }, 300);
    return () => clearTimeout(t);
  }, [brregSearch, searchBrreg]);

  const selectCompany = (c: BrregCompany) => {
    setSelectedCompany(c);
    setBrregSearch('');
    setBrregResults([]);
  };

  const companyAddress = useMemo(() => {
    if (!selectedCompany?.forretningsadresse) return '';
    const a = selectedCompany.forretningsadresse;
    return [a.adresse?.join(', '), `${a.postnummer || ''} ${a.poststed || ''}`.trim()].filter(Boolean).join(', ');
  }, [selectedCompany]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/invites/admin/create-and-send', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          profession,
          companyName: selectedCompany?.navn || '',
          organizationNumber: selectedCompany?.organisasjonsnummer || '',
          businessAddress: companyAddress,
          phoneNumber: phone || undefined,
          selectedPlan,
          planName: PLAN_OPTIONS.find((p) => p.value === selectedPlan)?.label || 'Basic',
          roleId,
          templateId,
          personalMessage: personalMessage || undefined,
          adminNotes: adminNotes || undefined,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invites/admin/requests'] });
      handleClose();
    },
  });

  const handleClose = () => {
    setStep(0);
    setSelectedCompany(null);
    setFirstName(''); setLastName(''); setEmail(''); setPhone('');
    setProfession(''); setSelectedPlan('basic'); setRoleId('user'); setTemplateId('access-approved');
    setPersonalMessage(''); setAdminNotes('');
    onClose();
  };

  const canProceed = () => {
    if (step === 0) return !!selectedCompany;
    if (step === 1) return !!firstName && !!lastName && !!email && !!profession;
    if (step === 2) return !!selectedPlan;
    if (step === 3) return !!templateId;
    return false;
  };

  const selectedPreset = INVITE_TEMPLATES.find((p) => p.id === templateId);

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(255,255,255,0.04)' }}>
        <PersonAdd sx={{ color: '#ff8c00' }} />
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>Inviter ny bruker</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton onClick={handleClose} size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: 'rgba(15,23,42,0.95)', minHeight: 400 }}>
        <Stepper activeStep={step} sx={{ my: 3, '& .MuiStepLabel-label': { color: 'rgba(255,255,255,0.6)' }, '& .MuiStepLabel-label.Mui-active': { color: '#ff8c00' }, '& .MuiStepLabel-label.Mui-completed': { color: '#4caf50' } }}>
          {STEPS.map((s) => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
        </Stepper>

        {/* Step 0: Bedrift (BRREG) */}
        {step === 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'rgba(255,255,255,0.7)' }}>
              S\u00f8k etter bedrift i Br\u00f8nn\u00f8ysundregistrene
            </Typography>
            <TextField
              fullWidth size="small" placeholder="Bedriftsnavn eller org.nr..."
              value={brregSearch} onChange={(e) => setBrregSearch(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'rgba(255,255,255,0.4)' }} /> }}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: '#fff' } }}
            />
            {brregLoading && <CircularProgress size={20} sx={{ ml: 2 }} />}
            {brregResults.length > 0 && (
              <Box sx={{ maxHeight: 250, overflow: 'auto' }}>
                {brregResults.map((c) => (
                  <Card key={c.organisasjonsnummer} onClick={() => selectCompany(c)}
                    sx={{ mb: 1, cursor: 'pointer', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', '&:hover': { borderColor: '#ff8c00' } }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{c.navn}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        Org.nr: {c.organisasjonsnummer} {c.naeringskode1?.beskrivelse ? `| ${c.naeringskode1.beskrivelse}` : ''}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
            {selectedCompany && (
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedCompany.navn}</Typography>
                <Typography variant="caption">Org.nr: {selectedCompany.organisasjonsnummer} | {companyAddress}</Typography>
              </Alert>
            )}
          </Box>
        )}

        {/* Step 1: Kontakt + Profesjon */}
        {step === 1 && (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField label="Fornavn" value={firstName} onChange={(e) => setFirstName(e.target.value)} size="small" required
                sx={{ '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiOutlinedInput-root': { color: '#fff' } }} />
              <TextField label="Etternavn" value={lastName} onChange={(e) => setLastName(e.target.value)} size="small" required
                sx={{ '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiOutlinedInput-root': { color: '#fff' } }} />
            </Box>
            <TextField label="E-post" type="email" value={email} onChange={(e) => setEmail(e.target.value)} size="small" required
              sx={{ '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiOutlinedInput-root': { color: '#fff' } }} />
            <TextField label="Telefon (valgfritt)" value={phone} onChange={(e) => setPhone(e.target.value)} size="small"
              sx={{ '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiOutlinedInput-root': { color: '#fff' } }} />
            <FormControl size="small" required>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.5)' }}>Profesjon</InputLabel>
              <Select value={profession} onChange={(e) => setProfession(e.target.value)} label="Profesjon"
                sx={{ color: '#fff' }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#1e293b', color: '#fff', maxHeight: 300 } } }}>
                {PROFESSION_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value} sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' }, '&.Mui-selected': { bgcolor: 'rgba(255,140,0,0.2)' } }}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" required>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.5)' }}>Brukertype (rolle)</InputLabel>
              <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} label="Brukertype (rolle)"
                sx={{ color: '#fff' }}
                MenuProps={{ PaperProps: { sx: { bgcolor: '#1e293b', color: '#fff', maxHeight: 300 } } }}>
                {roles.map((r) => <MenuItem key={r.id} value={r.id} sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' }, '&.Mui-selected': { bgcolor: 'rgba(255,140,0,0.2)' } }}>{r.name}</MenuItem>)}
                {roles.length === 0 && <MenuItem value="user" sx={{ color: '#fff' }}>Bruker</MenuItem>}
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Step 2: Abonnement */}
        {step === 2 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
              Velg abonnement for {firstName} {lastName}
            </Typography>
            <Box sx={{ display: 'grid', gap: 2 }}>
              {PLAN_OPTIONS.map((plan) => (
                <Card key={plan.value}
                  onClick={() => setSelectedPlan(plan.value)}
                  sx={{ cursor: 'pointer', bgcolor: selectedPlan === plan.value ? `${plan.color}15` : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${selectedPlan === plan.value ? plan.color : 'rgba(255,255,255,0.08)'}`,
                    '&:hover': { borderColor: plan.color } }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '12px !important' }}>
                    <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${plan.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: selectedPlan === plan.value ? plan.color : 'transparent' }}>
                      {selectedPlan === plan.value && <CheckCircle sx={{ fontSize: 14, color: '#fff' }} />}
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{plan.label}</Typography>
                    </Box>
                    {plan.popular && <Chip label="Popul\u00e6r" size="small" sx={{ bgcolor: `${plan.color}30`, color: plan.color }} />}
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        )}

        {/* Step 3: E-post */}
        {step === 3 && (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Velg e-postmal
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              {INVITE_TEMPLATES.map((preset) => (
                <Card key={preset.id}
                  onClick={() => setTemplateId(preset.id)}
                  sx={{ cursor: 'pointer', bgcolor: templateId === preset.id ? `${preset.accentColor}15` : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${templateId === preset.id ? preset.accentColor : 'rgba(255,255,255,0.08)'}`,
                    '&:hover': { borderColor: preset.accentColor } }}>
                  <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, mb: 0.5 }}>{preset.title}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{preset.description}</Typography>
                    <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {preset.tags.slice(0, 3).map((t) => (
                        <Chip key={t} label={t} size="small"
                          sx={{ height: 18, fontSize: '0.65rem', bgcolor: `${preset.accentColor}20`, color: preset.accentColor }} />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>

            {selectedPreset && (
              <Alert severity="info" sx={{ bgcolor: 'rgba(33,150,243,0.08)', color: 'rgba(255,255,255,0.8)' }}>
                <Typography variant="caption">
                  Mal: {selectedPreset.title} | Emne: &ldquo;{selectedPreset.template.subject}&rdquo;
                </Typography>
              </Alert>
            )}

            <TextField label="Personlig melding (valgfritt)" value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)} multiline rows={2} size="small"
              placeholder="Legg til en personlig hilsen i e-posten..."
              sx={{ '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiOutlinedInput-root': { color: '#fff' } }} />

            <TextField label="Admin-notat (internt)" value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)} multiline rows={2} size="small"
              placeholder="Interne notater..."
              sx={{ '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }, '& .MuiOutlinedInput-root': { color: '#fff' } }} />
          </Box>
        )}

        {createMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {(createMutation.error as Error)?.message || 'Kunne ikke opprette invitasjon'}
          </Alert>
        )}
        {createMutation.isSuccess && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Invitasjon opprettet og sendt til {email}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ bgcolor: 'rgba(15,23,42,0.95)', px: 3, py: 2 }}>
        {step > 0 && (
          <AdminButton tone="ghost" onClick={() => setStep((s) => s - 1)} startIcon={<ArrowBack />}>
            Tilbake
          </AdminButton>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <AdminButton tone="ghost" onClick={handleClose}>Avbryt</AdminButton>
        {step < STEPS.length - 1 ? (
          <AdminButton tone="primary" onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
            Neste
          </AdminButton>
        ) : (
          <AdminButton tone="primary" onClick={() => createMutation.mutate()}
            disabled={!canProceed() || createMutation.isPending}
            startIcon={createMutation.isPending ? <CircularProgress size={16} /> : <Send />}>
            {createMutation.isPending ? 'Sender...' : 'Opprett og send'}
          </AdminButton>
        )}
      </DialogActions>
    </Dialog>
    </ThemeProvider>
  );
}
