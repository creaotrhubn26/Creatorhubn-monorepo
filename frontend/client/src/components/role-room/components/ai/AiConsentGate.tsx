// @ts-nocheck
/**
 * AiConsentGate — wraps any Role Room Agent entry point behind an explicit
 * GDPR consent dialog. If consent is absent or revoked, the surface shows
 * a consent prompt instead of invoking the agent.
 *
 * GDPR Art. 6.1a/7: consent is freely given, specific, informed and
 * unambiguous. The dialog describes:
 *   - hvilke felt som sendes (scope)
 *   - databehandler (Anthropic — eller Cohere inntil Claude rullet ut)
 *   - lagringssted og retensjon
 *   - retten til å trekke tilbake
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import {
  AiConsentScope,
  getProjectConsent,
  grantProjectConsent,
  hydrateProjectConsent,
  revokeProjectConsent,
} from '../../services/aiConsentService';

interface AiConsentGateProps {
  projectId: string;
  currentUserId: string;
  /** Rendered when consent exists. */
  children: React.ReactNode;
  /** Rendered when consent is missing. Defaults to a consent prompt. */
  fallback?: React.ReactNode;
}

const SCOPE_LABELS: Record<AiConsentScope, string> = {
  brief_only: 'Kun klientbrief (mål, leveranser, referanser)',
  brief_and_reviews: 'Brief + godkjenninger + tidslinje',
  full_context: 'Brief + godkjenninger + tidslinje + pseudonymiserte kandidater/crew',
};

export const AiConsentGate: React.FC<AiConsentGateProps> = ({
  projectId,
  currentUserId,
  children,
  fallback,
}) => {
  const [record, setRecord] = useState(() => getProjectConsent(projectId));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scope, setScope] = useState<AiConsentScope>('brief_only');
  const [note, setNote] = useState('');
  const [acknowledgedProcessor, setAcknowledgedProcessor] = useState(false);
  const [acknowledgedRights, setAcknowledgedRights] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hydrate the cache from the backend on mount so the gate reflects the
  // authoritative state, not just localStorage. Runs once per projectId.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hydrated = await hydrateProjectConsent(projectId, currentUserId);
      if (!cancelled) setRecord(hydrated);
    })();
    return () => { cancelled = true; };
  }, [projectId, currentUserId]);

  if (record) return <>{children}</>;

  const canGrant = acknowledgedProcessor && acknowledgedRights && !pending;

  const handleGrant = async () => {
    setPending(true);
    setErrorMsg(null);
    try {
      const next = await grantProjectConsent({
        projectId,
        scope,
        grantedByUserId: currentUserId,
        note: note.trim() || undefined,
      });
      setRecord(next);
      setDialogOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Kunne ikke registrere samtykke');
    } finally {
      setPending(false);
    }
  };

  const handleRevoke = async () => {
    setPending(true);
    setErrorMsg(null);
    try {
      await revokeProjectConsent(projectId);
      setRecord(null);
      setDialogOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Kunne ikke trekke tilbake');
    } finally {
      setPending(false);
    }
  };

  const defaultFallback = (
    <Alert
      severity="info"
      variant="outlined"
      action={
        <Button size="small" onClick={() => setDialogOpen(true)}>
          Vurder samtykke
        </Button>
      }
    >
      AI-assistenten (Role Room Agent) er slått av for dette prosjektet. Du må gi et tydelig
      samtykke før data sendes til en ekstern databehandler.
    </Alert>
  );

  return (
    <>
      {fallback ?? defaultFallback}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>AI-samtykke for prosjekt</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Role Room Agent analyserer prosjektdata for å foreslå neste steg. Ingenting sendes til
            AI før du gir et uttrykkelig samtykke. Du kan trekke samtykket tilbake når som helst.
          </DialogContentText>

          <Stack spacing={2}>
            <TextField
              select
              label="Omfang av data som kan sendes"
              value={scope}
              onChange={(event) => setScope(event.target.value as AiConsentScope)}
              fullWidth
            >
              {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </TextField>

            <TextField
              value={note}
              onChange={(event) => setNote(event.target.value)}
              label="Notat (valgfri, loggføres)"
              fullWidth
              multiline
              minRows={2}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={acknowledgedProcessor}
                  onChange={(event) => setAcknowledgedProcessor(event.target.checked)}
                />
              }
              label={(
                <Typography variant="body2">
                  Jeg forstår at data behandles av en ekstern databehandler (Anthropic / Cohere) med
                  egen personvernerklæring og signert databehandleravtale. Data brukes ikke til å
                  trene modeller.
                </Typography>
              )}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={acknowledgedRights}
                  onChange={(event) => setAcknowledgedRights(event.target.checked)}
                />
              }
              label={(
                <Typography variant="body2">
                  Jeg er kjent med retten til innsyn, korrigering, sletting og tilbaketrekking
                  (GDPR Art. 15-22) og at samtykket kan slettes i profilinnstillingene.
                </Typography>
              )}
            />

            <Alert severity="warning" variant="outlined">
              Kandidat- og crew-navn, e-post og telefon pseudonymiseres automatisk før de sendes.
              Originaldata forlater aldri vår server uten denne maskeringen.
            </Alert>

            {errorMsg ? <Alert severity="error">{errorMsg}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button color="error" onClick={handleRevoke} disabled={pending}>
            Trekk tilbake eksisterende
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setDialogOpen(false)} disabled={pending}>
            Avbryt
          </Button>
          <Button variant="contained" onClick={handleGrant} disabled={!canGrant}>
            {pending ? 'Lagrer …' : 'Gi samtykke'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AiConsentGate;
