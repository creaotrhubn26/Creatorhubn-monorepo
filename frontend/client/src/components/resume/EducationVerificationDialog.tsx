/**
 * EducationVerificationDialog — verifisering av utdanning på CV.
 *
 * Brukerflyt:
 *   1. Bruker velger utdanning fra liste (CV-ens egne education-rader)
 *   2. To valg: last opp PDF/bilde ELLER lim inn verifiseringslenke
 *   3. GDPR-samtykke kreves (checkbox må huk for å aktivere "Lagre")
 *   4. Server validerer + lagrer; brukeren får tilbake bekreftelse
 *
 * UI bruker nøytrale begreper ("verifiseringslenke", "vitnemål") og
 * referere ikke spesifikke tredjeparts-tjenester før vi har faktisk
 * integrasjon på plass.
 */

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, TextField, Stack, Paper, Chip, IconButton,
  CircularProgress, Alert, Divider, MenuItem, ToggleButton, ToggleButtonGroup,
  Checkbox, FormControlLabel, Link as MuiLink,
} from '@mui/material';
import {
  Close as CloseIcon,
  Upload as UploadIcon,
  Link as LinkIcon,
  VerifiedUser as VerifiedIcon,
  Delete as DeleteIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

function trackGA4(eventName: string, params: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') w.gtag('event', eventName, params);
  } catch {
    /* noop */
  }
}

interface Education {
  id: string;
  degree: string;
  fieldOfStudy?: string | null;
  institution: string;
  // Verifikasjons-felt fra DB
  verification_pdf_filename?: string | null;
  verification_link_url?: string | null;
  verification_label?: string | null;
  verified_at?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  resumeId: string | null;
  educations: Education[];
}

type Mode = 'pdf' | 'link';

export const EducationVerificationDialog: React.FC<Props> = ({
  open, onClose, resumeId, educations,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEduId, setSelectedEduId] = useState<string>(
    educations[0]?.id ?? '',
  );
  const [mode, setMode] = useState<Mode>('pdf');

  // PDF
  const [file, setFile] = useState<File | null>(null);

  // Link
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');

  // GDPR
  const [consent, setConsent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedEdu = educations.find((e) => e.id === selectedEduId) ?? null;
  const isAlreadyVerified = !!selectedEdu?.verified_at;

  const resetForm = () => {
    setFile(null);
    setLinkUrl('');
    setLinkLabel('');
    setConsent(false);
    setError(null);
    setSuccess(false);
  };

  const handleSubmitPdf = async () => {
    if (!file || !resumeId || !selectedEduId) return;
    if (!consent) {
      setError('Du må godkjenne behandling av dokumentet.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('document', file);
      form.append('consent', 'true');
      const res = await fetch(
        `/api/resumes/${resumeId}/education/${selectedEduId}/verification-pdf`,
        {
          method: 'POST',
          headers: { 'x-user-id': user?.id || '' },
          body: form,
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `${res.status}`);
      }
      setSuccess(true);
      trackGA4('nextrole_education_verified', { mode: 'pdf' });
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
    } catch (err) {
      console.error('PDF-opplasting feilet', err);
      setError(
        err instanceof Error && err.message.includes('15')
          ? 'Filen er for stor (maks 15 MB).'
          : 'Opplasting feilet. Prøv på nytt.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitLink = async () => {
    if (!linkUrl.trim() || !resumeId || !selectedEduId) return;
    if (!consent) {
      setError('Du må godkjenne lagring av verifiseringslenken.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiRequest(
        `/api/resumes/${resumeId}/education/${selectedEduId}/verification-link`,
        {
          method: 'PATCH',
          headers: {
            'x-user-id': user?.id || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: linkUrl.trim(),
            label: linkLabel.trim() || undefined,
            consent: true,
          }),
        },
      );
      setSuccess(true);
      trackGA4('nextrole_education_verified', { mode: 'link' });
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
    } catch (err) {
      console.error('Verifiseringslenke feilet', err);
      const status = (err as { status?: number })?.status;
      if (status === 400) setError('Ugyldig URL. Sjekk at lenken starter med https://');
      else setError('Lagring feilet. Prøv på nytt.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!resumeId || !selectedEduId) return;
    if (!window.confirm('Fjerne verifisering for denne utdanningen?')) return;
    setLoading(true);
    try {
      await apiRequest(
        `/api/resumes/${resumeId}/education/${selectedEduId}/verification`,
        { method: 'DELETE', headers: { 'x-user-id': user?.id || '' } },
      );
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      onClose();
    } catch (err) {
      console.error('Sletting feilet', err);
      setError('Kunne ikke fjerne. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <VerifiedIcon sx={{ color: '#10B981' }} />
          <Typography variant="h6">Verifiser utdanning</Typography>
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            Marker utdanning som verifisert ved å laste opp vitnemål/karakterutskrift
            eller lime inn en verifiseringslenke. Det vises som en badge på CV-en din.
          </Alert>

          {educations.length === 0 ? (
            <Alert severity="warning">
              CV-en har ingen utdanning. Legg til utdanning først, så kan du verifisere den her.
            </Alert>
          ) : (
            <>
              <TextField
                select
                label="Hvilken utdanning?"
                value={selectedEduId}
                onChange={(e) => { setSelectedEduId(e.target.value); resetForm(); }}
                fullWidth
                size="small"
              >
                {educations.map((e) => (
                  <MenuItem key={e.id} value={e.id}>
                    {e.degree}
                    {e.fieldOfStudy && ` i ${e.fieldOfStudy}`}
                    {' — '}{e.institution}
                  </MenuItem>
                ))}
              </TextField>

              {isAlreadyVerified && (
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#F0FDF4', borderColor: '#10B981' }}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <VerifiedIcon sx={{ fontSize: 18, color: '#10B981' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {selectedEdu?.verification_label ?? 'Verifisert'}
                      </Typography>
                      {selectedEdu?.verification_pdf_filename && (
                        <Chip
                          icon={<DocumentIcon sx={{ fontSize: 14 }} />}
                          label={selectedEdu.verification_pdf_filename}
                          size="small"
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      )}
                      {selectedEdu?.verification_link_url && (
                        <Chip
                          icon={<LinkIcon sx={{ fontSize: 14 }} />}
                          label="Verifiseringslenke"
                          size="small"
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      )}
                    </Stack>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={handleRemove}
                      disabled={loading}
                    >
                      Fjern
                    </Button>
                  </Stack>
                </Paper>
              )}

              <Divider />

              {success && (
                <Alert severity="success">
                  Verifisering lagret. Du kan lukke dialogen.
                </Alert>
              )}

              {!success && !isAlreadyVerified && (
                <>
                  <ToggleButtonGroup
                    value={mode}
                    exclusive
                    onChange={(_, v) => v && setMode(v)}
                    size="small"
                    fullWidth
                  >
                    <ToggleButton value="pdf" sx={{ textTransform: 'none' }}>
                      <UploadIcon sx={{ fontSize: 18, mr: 1 }} />
                      Last opp vitnemål
                    </ToggleButton>
                    <ToggleButton value="link" sx={{ textTransform: 'none' }}>
                      <LinkIcon sx={{ fontSize: 18, mr: 1 }} />
                      Verifiseringslenke
                    </ToggleButton>
                  </ToggleButtonGroup>

                  {mode === 'pdf' && (
                    <Stack spacing={1}>
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={<UploadIcon />}
                        fullWidth
                      >
                        {file ? file.name : 'Velg fil (PDF eller bilde)'}
                        <input
                          hidden
                          type="file"
                          accept=".pdf,image/jpeg,image/png,image/webp"
                          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                      </Button>
                      <Typography variant="caption" color="text.secondary">
                        Maks 15 MB. Lagres kryptert. Kun synlig for deg og arbeidsgivere
                        du selv deler CV-en med via signed URL (24t levetid).
                      </Typography>
                    </Stack>
                  )}

                  {mode === 'link' && (
                    <Stack spacing={1}>
                      <TextField
                        label="Verifiseringslenke (URL)"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="https://..."
                        helperText="Lenke til en offentlig verifisering du selv har generert hos utdanningsinstitusjonen eller annen verifiseringstjeneste"
                      />
                      <TextField
                        label="Etikett (valgfritt)"
                        value={linkLabel}
                        onChange={(e) => setLinkLabel(e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="F.eks. 'Master fra UiO — verifisert'"
                      />
                    </Stack>
                  )}

                  {/* GDPR-consent */}
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#FAFAFA' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="caption">
                          Jeg samtykker til at NextRole behandler dette{' '}
                          {mode === 'pdf' ? 'dokumentet' : 'lenken'} for å markere utdanning som
                          verifisert på CV-en min. Jeg kan trekke samtykket når som
                          helst ved å fjerne verifiseringen. Se vår{' '}
                          <MuiLink href="/privacy-policy" target="_blank" rel="noopener">
                            personvernerklæring
                          </MuiLink>{' '}
                          for detaljer.
                        </Typography>
                      }
                    />
                  </Paper>

                  {error && <Alert severity="error">{error}</Alert>}
                </>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{success ? 'Lukk' : 'Avbryt'}</Button>
        {!success && !isAlreadyVerified && mode === 'pdf' && (
          <Button
            variant="contained"
            onClick={handleSubmitPdf}
            disabled={loading || !file || !consent}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
            sx={{ bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' }, fontWeight: 700 }}
          >
            {loading ? 'Laster opp…' : 'Verifiser med PDF'}
          </Button>
        )}
        {!success && !isAlreadyVerified && mode === 'link' && (
          <Button
            variant="contained"
            onClick={handleSubmitLink}
            disabled={loading || !linkUrl.trim() || !consent}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <LinkIcon />}
            sx={{ bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' }, fontWeight: 700 }}
          >
            {loading ? 'Lagrer…' : 'Verifiser med lenke'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EducationVerificationDialog;
