/**
 * DeliverFromArchiveDialog — UI for «Lever til klient»-flyten beskrevet
 * i apps/creatorhub-one-desk/docs/showcase-from-archive-plan.md.
 *
 * Steg:
 *   1. Hent arkiv-filer fra /api/dit/projects/:id/archive-files
 *   2. Filtrer + multi-select (per kamera, alle JPEG, manuell)
 *   3. Skriv inn klient-info (navn, e-post, galleri-label)
 *   4. Kall /deliver-to-showcase → få gallery_url
 *   5. Vis suksess-state med «Kopier lenke» + «Send e-post»
 *
 * Bytes flyttes IKKE — backend registrerer bare referanser. Cloudflare
 * Worker proxyer signed B2-URL on-demand når klient åpner galleriet.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import EmailIcon from '@mui/icons-material/Email';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
  ArchiveFile,
  deliverProjectToShowcase,
  DeliverToShowcaseResponse,
  listArchiveFiles,
} from '@/api/storageProviders';

interface Props {
  projectId: string;
  defaultGalleryLabel?: string;
  open: boolean;
  onClose: () => void;
}

type Step = 'loading' | 'pick' | 'meta' | 'sending' | 'done';

function humanBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function isWebViewable(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  return ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'].includes(ext);
}

export default function DeliverFromArchiveDialog({
  projectId,
  defaultGalleryLabel,
  open,
  onClose,
}: Props) {
  const [step, setStep] = useState<Step>('loading');
  const [files, setFiles] = useState<ArchiveFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Klient-meta
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [galleryLabel, setGalleryLabel] = useState(defaultGalleryLabel || '');

  // Send-resultat
  const [result, setResult] = useState<DeliverToShowcaseResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('loading');
    setError(null);
    setSelected(new Set());
    setResult(null);
    listArchiveFiles(projectId)
      .then((r) => {
        if (!r.success) {
          setError(r.error ?? 'Kunne ikke hente arkiv');
          return;
        }
        setFiles(r.files);
        setStep('pick');
      })
      .catch((e) => {
        setError(e?.message ?? String(e));
        setStep('pick');
      });
  }, [open, projectId]);

  const webViewable = useMemo(
    () => files.filter((f) => isWebViewable(f.filename)),
    [files],
  );
  const selectedCount = selected.size;
  const selectedBytes = useMemo(() => {
    let sum = 0;
    for (const f of files) {
      if (selected.has(f.source_path)) sum += f.size_bytes ?? 0;
    }
    return sum;
  }, [files, selected]);

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectAllWebViewable = () => {
    setSelected(new Set(webViewable.map((f) => f.source_path)));
  };

  const clearSelection = () => setSelected(new Set());

  const handleNext = () => {
    if (selectedCount === 0) return;
    setStep('meta');
  };

  const handleSend = async () => {
    if (!clientName.trim() || !clientEmail.trim()) return;
    setStep('sending');
    setError(null);
    try {
      const r = await deliverProjectToShowcase(projectId, {
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        gallery_label: galleryLabel.trim() || undefined,
        source_paths: Array.from(selected),
      });
      if (!r.success) {
        setError(r.error ?? 'Sending feilet');
        setStep('meta');
        return;
      }
      setResult(r);
      setStep('done');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStep('meta');
    }
  };

  const handleCopy = async () => {
    if (!result?.gallery_url) return;
    const fullUrl = `${window.location.origin}${result.gallery_url}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
    } catch {
      // fallback: bare velg tekst i en alert. For nå stille.
    }
  };

  const handleEmail = () => {
    if (!result?.gallery_url) return;
    const fullUrl = `${window.location.origin}${result.gallery_url}`;
    const subject = `Galleri klart: ${galleryLabel || clientName}`;
    const body = `Hei ${clientName.split(' ')[0]},\n\nGalleriet ditt er klart:\n${fullUrl}\n\nMvh\n`;
    window.open(
      `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(body)}`,
      '_blank',
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            Lever fra B2-arkiv
          </Typography>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
            {step === 'done' ? '✓ Sendt' : 'Velg filer til klient'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {step === 'loading' && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={24} />
            <Typography sx={{ mt: 2 }} color="text.secondary">
              Henter arkiv-filer…
            </Typography>
          </Box>
        )}

        {step === 'pick' && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Velg hvilke filer fra B2-arkivet klienten skal kunne se. Ingen
              bytes flyttes — galleriet henter direkte fra Backblaze via
              Cloudflare-cache. Web-viewable filer (JPEG/PNG/HEIC) anbefales;
              RAW kan også velges, men kun for download.
            </Typography>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                onClick={selectAllWebViewable}
              >
                Velg alle JPEG/PNG/HEIC ({webViewable.length})
              </Button>
              {selectedCount > 0 && (
                <Button size="small" onClick={clearSelection}>
                  Nullstill
                </Button>
              )}
            </Stack>

            <Box
              sx={{
                maxHeight: 360,
                overflowY: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <List dense disablePadding>
                {files.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="Ingen filer i B2-arkiv ennå."
                      secondary="Aktiver offsite-backup og kjør en backup-økt for å fylle arkivet."
                    />
                  </ListItem>
                )}
                {files.slice(0, 500).map((f) => (
                  <ListItem
                    key={f.source_path}
                    onClick={() => toggle(f.source_path)}
                    sx={{ cursor: 'pointer' }}
                    secondaryAction={
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {humanBytes(f.size_bytes)}
                        </Typography>
                        {!isWebViewable(f.filename) && (
                          <Chip
                            size="small"
                            label="RAW"
                            color="warning"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    }
                  >
                    <Checkbox
                      edge="start"
                      checked={selected.has(f.source_path)}
                      tabIndex={-1}
                      disableRipple
                    />
                    <ListItemText
                      primary={f.filename}
                      secondary={
                        f.camera_id ? `${f.camera_id} · ${f.source_path}` : f.source_path
                      }
                      primaryTypographyProps={{ noWrap: true }}
                      secondaryTypographyProps={{
                        noWrap: true,
                        sx: { fontFamily: 'monospace', fontSize: 11 },
                      }}
                    />
                  </ListItem>
                ))}
                {files.length > 500 && (
                  <ListItem>
                    <ListItemText
                      primary={`… og ${files.length - 500} flere`}
                      secondary="Bruk «Velg alle» eller filter — listen er begrenset til 500 i UI"
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          </Stack>
        )}

        {step === 'meta' && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {selectedCount} filer · {humanBytes(selectedBytes)} klar til
              levering. Skriv inn klient-info så genereres en tilgangs-lenke.
            </Typography>
            <TextField
              fullWidth
              label="Klient-navn"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Klient-e-post"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Galleri-tittel (vises for klienten)"
              value={galleryLabel}
              onChange={(e) => setGalleryLabel(e.target.value)}
              placeholder={defaultGalleryLabel || 'F.eks. «Bryllup 15. juni»'}
            />
          </Stack>
        )}

        {step === 'sending' && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={24} />
            <Typography sx={{ mt: 2 }} color="text.secondary">
              Oppretter galleri og {selectedCount} items…
            </Typography>
          </Box>
        )}

        {step === 'done' && result && (
          <Stack spacing={2}>
            <Box sx={{ textAlign: 'center' }}>
              <CheckCircleOutlineIcon color="success" sx={{ fontSize: 64 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                Galleri opprettet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {result.delivered} av {selectedCount} filer levert
                {result.skipped && result.skipped > 0
                  ? ` (${result.skipped} hoppet over — duplikat)`
                  : ''}
                .
              </Typography>
            </Box>

            <Divider />

            <Box
              sx={{
                p: 2,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Tilgangs-lenke
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', mt: 0.5 }}
              >
                <LinkIcon fontSize="small" color="primary" />
                <Link
                  href={result.gallery_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: 13,
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {window.location.origin}
                  {result.gallery_url}
                </Link>
              </Stack>
            </Box>

            {result.errors && result.errors.length > 0 && (
              <Alert severity="warning">
                <Typography variant="caption">
                  {result.errors.length} feil under levering — første 3:
                </Typography>
                {result.errors.slice(0, 3).map((e, i) => (
                  <Typography
                    key={i}
                    variant="caption"
                    sx={{ display: 'block', fontFamily: 'monospace' }}
                  >
                    {e}
                  </Typography>
                ))}
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        {step === 'pick' && (
          <>
            <Box sx={{ flex: 1, pl: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {selectedCount > 0
                  ? `${selectedCount} valgt · ${humanBytes(selectedBytes)}`
                  : `${files.length} filer tilgjengelig`}
              </Typography>
            </Box>
            <Button onClick={onClose}>Avbryt</Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={selectedCount === 0}
            >
              Neste — klient-info
            </Button>
          </>
        )}
        {step === 'meta' && (
          <>
            <Button onClick={() => setStep('pick')}>Tilbake</Button>
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={!clientName.trim() || !clientEmail.trim()}
            >
              Lever {selectedCount} filer
            </Button>
          </>
        )}
        {step === 'done' && (
          <>
            <Button startIcon={<ContentCopyIcon />} onClick={handleCopy}>
              Kopier lenke
            </Button>
            <Button
              startIcon={<EmailIcon />}
              variant="contained"
              onClick={handleEmail}
            >
              Send e-post til klient
            </Button>
            <Button onClick={onClose}>Lukk</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
