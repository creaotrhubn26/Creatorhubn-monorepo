/**
 * CloudDestinationActivator — aktiver offsite-backup for ett prosjekt.
 *
 * To-trinns dialog: velg storage-provider → velg bucket → opprett
 * cloud-destinasjon. EU-region flagges grønt; non-EU-buckets flagges
 * rødt med advarsel om at de ikke anbefales for GDPR-samsvar.
 *
 * Brukes både i prosjekt-creation-wizard og i prosjekt-settings.
 */

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import AddIcon from '@mui/icons-material/Add';
import {
  B2Bucket,
  createCloudDestination,
  listBuckets,
  listStorageProviders,
  StorageProvider,
} from '@/api/storageProviders';

interface Props {
  projectId: string;
  /** Trigget når en cloud-destinasjon er opprettet. */
  onActivated?: () => void;
}

type Step = 'pick-provider' | 'pick-bucket' | 'confirming';

export default function CloudDestinationActivator({ projectId, onActivated }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('pick-provider');
  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [chosenProvider, setChosenProvider] = useState<StorageProvider | null>(null);
  const [buckets, setBuckets] = useState<B2Bucket[]>([]);
  const [gdprWarning, setGdprWarning] = useState<string | null>(null);
  const [chosenBucket, setChosenBucket] = useState<B2Bucket | null>(null);
  const [destLabel, setDestLabel] = useState('Backblaze offsite');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = () => {
    setStep('pick-provider');
    setChosenProvider(null);
    setBuckets([]);
    setGdprWarning(null);
    setChosenBucket(null);
    setDestLabel('Backblaze offsite');
    setError(null);
    setSuccess(null);
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listStorageProviders()
      .then((r) => {
        if (r.success) setProviders(r.providers);
        else setError(r.error ?? 'Kunne ikke hente providers');
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [open]);

  const handlePickProvider = async (p: StorageProvider) => {
    setChosenProvider(p);
    setLoading(true);
    setError(null);
    try {
      const r = await listBuckets(p.id);
      if (!r.success) {
        setError(r.error ?? 'Kunne ikke hente buckets');
        return;
      }
      setBuckets(r.buckets);
      setGdprWarning(r.gdpr_warning);
      setStep('pick-bucket');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!chosenProvider || !chosenBucket) return;
    setStep('confirming');
    setLoading(true);
    setError(null);
    try {
      const r = await createCloudDestination(projectId, {
        provider_id: chosenProvider.id,
        bucket_id: chosenBucket.id,
        bucket_name: chosenBucket.name,
        label: destLabel.trim() || `B2 ${chosenBucket.name}`,
      });
      if (!r.success) {
        setError(r.error ?? 'Kunne ikke opprette destinasjon');
        setStep('pick-bucket');
        return;
      }
      setSuccess(`Offsite-backup aktivert via «${chosenBucket.name}»`);
      onActivated?.();
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 1500);
    } catch (e: any) {
      setError(e?.message || String(e));
      setStep('pick-bucket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<CloudOutlinedIcon />}
        onClick={() => setOpen(true)}
      >
        Aktiver offsite-backup
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {step === 'pick-provider' && 'Velg storage-konto'}
          {step === 'pick-bucket' && 'Velg bucket'}
          {step === 'confirming' && 'Aktiverer…'}
          <IconButton
            onClick={() => {
              setOpen(false);
              reset();
            }}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          {/* STEG 1: pick provider */}
          {step === 'pick-provider' && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Filene lastes opp direkte fra Creatorhub One Desk til
                Backblaze. Vi ser aldri innholdet.
              </Typography>
              {loading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : providers.length === 0 ? (
                <Alert severity="info">
                  Du har ingen storage-konto satt opp ennå. Gå til Settings →
                  Ekstern backup og legg til en Backblaze-konto først.
                </Alert>
              ) : (
                <List dense disablePadding>
                  {providers.map((p) => (
                    <Card key={p.id} variant="outlined" sx={{ mb: 1 }}>
                      <ListItemButton onClick={() => handlePickProvider(p)}>
                        <ListItemText
                          primary={
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ alignItems: 'center' }}
                            >
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {p.account_label}
                              </Typography>
                              <Chip
                                size="small"
                                label={p.provider.toUpperCase()}
                                color="primary"
                                variant="outlined"
                              />
                              {p.validated_at && (
                                <Chip
                                  size="small"
                                  label="Validert"
                                  color="success"
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                          }
                        />
                      </ListItemButton>
                    </Card>
                  ))}
                </List>
              )}
            </Stack>
          )}

          {/* STEG 2: pick bucket */}
          {step === 'pick-bucket' && chosenProvider && (
            <Stack spacing={2}>
              {gdprWarning && (
                <Alert
                  severity="warning"
                  icon={<WarningAmberOutlinedIcon />}
                >
                  {gdprWarning}{' '}
                  <Link
                    href="https://www.backblaze.com/docs/cloud-storage-create-bucket"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Slik oppretter du en EU-bucket
                  </Link>
                </Alert>
              )}
              {loading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : buckets.length === 0 ? (
                <Alert severity="info">
                  Ingen buckets funnet på «{chosenProvider.account_label}». Opprett en bucket i Backblaze-konsollen først (anbefalt navn: «creatorhub-backup»).
                </Alert>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Klikk for å velge bucket. EU-buckets er trygge for GDPR.
                  </Typography>
                  <List dense disablePadding>
                    {buckets.map((b) => (
                      <Card
                        key={b.id}
                        variant="outlined"
                        sx={{
                          mb: 1,
                          borderColor:
                            chosenBucket?.id === b.id
                              ? 'primary.main'
                              : undefined,
                          borderWidth: chosenBucket?.id === b.id ? 2 : 1,
                        }}
                      >
                        <ListItemButton onClick={() => setChosenBucket(b)}>
                          <ListItemText
                            primary={
                              <Stack
                                direction="row"
                                spacing={1}
                                sx={{ alignItems: 'center' }}
                              >
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                  {b.name}
                                </Typography>
                                {b.is_gdpr_safe ? (
                                  <Chip
                                    size="small"
                                    icon={<VerifiedUserOutlinedIcon />}
                                    label={`${b.region} (GDPR)`}
                                    color="success"
                                    variant="outlined"
                                  />
                                ) : (
                                  <Chip
                                    size="small"
                                    icon={<WarningAmberOutlinedIcon />}
                                    label={b.region}
                                    color="warning"
                                  />
                                )}
                              </Stack>
                            }
                            secondary={`Type: ${b.type}`}
                          />
                        </ListItemButton>
                      </Card>
                    ))}
                  </List>
                  {chosenBucket && (
                    <>
                      <TextField
                        label="Etikett (for One Desk)"
                        value={destLabel}
                        onChange={(e) => setDestLabel(e.target.value)}
                        size="small"
                        fullWidth
                        helperText="Vises som destinasjons-navn i Creatorhub One Desk"
                      />
                      {!chosenBucket.is_gdpr_safe && (
                        <Alert severity="error">
                          Bucketen er ikke i en EU-region. Filene vil bli
                          overført til USA, som krever standardkontrakter
                          (SCC) og Transfer Impact Assessment per Schrems
                          II. Vi anbefaler på det sterkeste å bytte til en
                          EU Central-bucket.
                        </Alert>
                      )}
                    </>
                  )}
                </>
              )}
            </Stack>
          )}

          {step === 'confirming' && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={24} />
              <Typography sx={{ mt: 2 }} color="text.secondary">
                Oppretter cloud-destinasjon…
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          {step === 'pick-provider' && (
            <Button
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Avbryt
            </Button>
          )}
          {step === 'pick-bucket' && (
            <>
              <Button
                onClick={() => {
                  setStep('pick-provider');
                  setChosenBucket(null);
                  setBuckets([]);
                }}
              >
                Tilbake
              </Button>
              <Button
                variant="contained"
                onClick={handleConfirm}
                disabled={!chosenBucket || loading}
                startIcon={<AddIcon />}
              >
                Aktiver offsite
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
