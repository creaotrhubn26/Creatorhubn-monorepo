/**
 * StorageProviderStep — onboarding-steg for offsite-backup-setup.
 *
 * Bruker setter opp egen Backblaze-konto + application key. Vi
 * validerer faktisk mot Backblaze (POST /api/storage/providers
 * gjør authorize-call) før credsen lagres kryptert.
 *
 * Brukes både i wizard-flyten (med "Hopp over"-knapp) og frittstående
 * i Settings (uten Skip).
 */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Link,
  Radio,
  RadioGroup,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import {
  createStorageProvider,
  StorageProvider,
} from '@/api/storageProviders';

interface Props {
  /** Bygg-inn-modus: vises som steg i wizard (med Skip-knapp). */
  variant?: 'wizard' | 'settings';
  /** Kalles når en provider er opprettet (eller bruker hopper over). */
  onCompleted?: (provider: StorageProvider | null) => void;
  /** Kun for variant=wizard: aktiverer Skip-knapp som lar bruker fortsette uten å sette opp. */
  onSkip?: () => void;
}

const BACKBLAZE_SIGNUP_URL = 'https://www.backblaze.com/sign-up/cloud-storage';
const BACKBLAZE_KEY_DOCS_URL =
  'https://www.backblaze.com/docs/cloud-storage-application-keys';

export default function StorageProviderStep({
  variant = 'wizard',
  onCompleted,
  onSkip,
}: Props) {
  const [accountOption, setAccountOption] = useState<'have' | 'new'>('have');
  const [accountLabel, setAccountLabel] = useState('Hovedkonto');
  const [keyId, setKeyId] = useState('');
  const [applicationKey, setApplicationKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdProvider, setCreatedProvider] =
    useState<StorageProvider | null>(null);

  const canSubmit =
    !busy && keyId.trim().length > 0 && applicationKey.trim().length > 0 && accountLabel.trim().length > 0;

  const handleCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await createStorageProvider({
        provider: 'b2',
        account_label: accountLabel.trim(),
        key_id: keyId.trim(),
        application_key: applicationKey.trim(),
      });
      if (!result.success || !result.provider) {
        setError(result.error ?? 'Ukjent feil ved validering mot Backblaze');
        return;
      }
      setCreatedProvider(result.provider);
      // Reset key-feltene så de ikke ligger i UI-state
      setKeyId('');
      setApplicationKey('');
      onCompleted?.(result.provider);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  // Etter opprettelse: vis bekreftelse + fortsett-knapp
  if (createdProvider) {
    return (
      <Stack spacing={3} sx={{ textAlign: 'center', py: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CheckCircleOutlineIcon color="success" sx={{ fontSize: 64 }} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Tilkoblet «{createdProvider.account_label}»
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Backblaze er nå konfigurert som offsite-destinasjon. Du kan
            aktivere det per prosjekt fra prosjekt-innstillingene.
          </Typography>
        </Box>
        {variant === 'wizard' && (
          <Button variant="contained" size="large" onClick={() => onCompleted?.(createdProvider)}>
            Fortsett
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <CloudOutlinedIcon sx={{ fontSize: 40, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Ekstern backup (offsite)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Beskytt prosjekt-filene dine — RAW-er, master-spor, deliverables
            og kunde-arkiver — mot lokal disk-feil eller tyveri. Profesjonell
            praksis (3-2-1-regelen) krever én kopi utenfor lokasjonen. Vi
            anbefaler Backblaze B2 — du eier kontoen og dataen.
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          p: 2,
          borderRadius: 1,
          border: '1px dashed',
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Pris og eierskap
        </Typography>
        <Typography variant="body2">
          Backblaze fakturerer deg direkte (~$6/TB/mnd). Vi tar 0 kr i
          påslag. Filene ligger på din konto — Creatorhub ser dem aldri.
        </Typography>
      </Box>

      <Divider />

      <RadioGroup
        value={accountOption}
        onChange={(e) => setAccountOption(e.target.value as 'have' | 'new')}
      >
        <FormControlLabel value="have" control={<Radio />} label="Jeg har en Backblaze-konto" />
        <FormControlLabel value="new" control={<Radio />} label="Jeg trenger å opprette en konto" />
      </RadioGroup>

      {accountOption === 'new' && (
        <Alert severity="info" icon={<OpenInNewIcon />}>
          <Stack spacing={1}>
            <Typography variant="body2">
              Opprett konto hos Backblaze i en ny fane, generer en application key, og kom tilbake hit for å lime inn detaljene.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                href={BACKBLAZE_SIGNUP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Opprett Backblaze-konto
              </Button>
              <Button
                size="small"
                startIcon={<OpenInNewIcon />}
                href={BACKBLAZE_KEY_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Slik genererer du en key
              </Button>
            </Stack>
          </Stack>
        </Alert>
      )}

      <TextField
        label="Kontonavn (kun for deg)"
        placeholder="Hovedkonto"
        value={accountLabel}
        onChange={(e) => setAccountLabel(e.target.value)}
        fullWidth
        size="small"
        helperText="Brukes hvis du har flere Backblaze-konti"
      />

      <TextField
        label="Key ID"
        placeholder="0042xxxxxxxxxxxxxx0000000001"
        value={keyId}
        onChange={(e) => setKeyId(e.target.value)}
        fullWidth
        size="small"
        autoComplete="off"
      />

      <TextField
        label="Application Key"
        placeholder="K004xxxxxxxxxxxxxxxxxxxxxxxxxxx"
        value={applicationKey}
        onChange={(e) => setApplicationKey(e.target.value)}
        fullWidth
        size="small"
        type="password"
        autoComplete="off"
        helperText={
          <>
            Vises bare under opprettelse. Lagres aldri som klartekst —{' '}
            <Link
              href="https://www.backblaze.com/docs/cloud-storage-application-keys"
              target="_blank"
              rel="noopener noreferrer"
            >
              les Backblaze-dokumentasjonen
            </Link>
            .
          </>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {variant === 'wizard' && onSkip && (
          <Button onClick={onSkip} disabled={busy}>
            Hopp over for nå
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!canSubmit}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {busy ? 'Validerer mot Backblaze…' : 'Koble til'}
        </Button>
      </Stack>
    </Stack>
  );
}
