import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  Inventory2 as InventoryIcon,
} from '@mui/icons-material';
import type {
  ExportCrop,
  ExportCropAspect,
  ExportPreset,
  ExportResize,
  ExportWatermark,
  SessionImage,
} from '../../lib/enhancer-session/types';
import {
  extensionForFormat,
  renderPresetForImages,
  triggerDownload,
  type ExportProgress,
} from '../../lib/enhancer-session/export-engine';
import {
  describeCropAspect,
  EXPORT_CROP_ASPECTS,
} from '../../lib/enhancer-session/export-crop';
import {
  describeSharpenLevel,
  SHARPEN_LEVELS,
  type SharpenLevel,
} from '../../lib/enhancer-session/export-sharpen';
import { renderFilename } from '../../lib/enhancer-session/naming-tokens';

export interface ExportPresetDialogProps {
  open: boolean;
  onClose: () => void;
  preset: ExportPreset | null;
  onSavePreset: (preset: ExportPreset) => void;
  onDeletePreset?: (presetId: string) => void;
  images: SessionImage[];
  projectName?: string;
  clientName?: string;
  /** Logged-in photographer id — required for the delivery flow to
   *  know which account to bill the gallery to. When null/undefined
   *  the "Lever til klientgalleri" button is hidden. */
  photographerId?: string;
  /** Seed for the delivery form's email field. Photographer can edit. */
  clientEmail?: string;
}

const DEFAULT_TEMPLATE = '{project_name}_{sequence:04}';
const AVAILABLE_TOKENS = [
  '{original_name}',
  '{sequence}',
  '{sequence:04}',
  '{date:YYYY-MM-DD}',
  '{time:HHmm}',
  '{project_name}',
  '{client}',
  '{camera}',
  '{custom_text}',
] as const;

const WATERMARK_POSITIONS: ExportWatermark['position'][] = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

/**
 * Flatten the `ExportCrop` union into a single Select value. Custom
 * object crops collapse to the string `'custom'` in the dropdown — the
 * actual w/h values live in the two companion TextFields below the
 * Select (revealed only when `typeof draft.crop === 'object'`).
 */
function cropSelectValue(crop: ExportCrop | undefined): ExportCropAspect | 'custom' {
  if (!crop) return 'none';
  if (typeof crop === 'object') return 'custom';
  return crop;
}

export function ExportPresetDialog(props: ExportPresetDialogProps) {
  const {
    open,
    onClose,
    preset,
    onSavePreset,
    onDeletePreset,
    images,
    projectName,
    clientName,
    photographerId,
    clientEmail,
  } = props;
  const [draft, setDraft] = useState<ExportPreset>(() => preset ?? makeDefaultPreset());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Client-gallery delivery state: the form collects/edits the client
  // info the backend needs, and `deliveredUrl` latches on success so
  // the photographer has a share link to copy. Seeded from props so
  // Daniel doesn't retype "Holy Crust" every time.
  const [deliveryClientName, setDeliveryClientName] = useState<string>(clientName ?? '');
  const [deliveryClientEmail, setDeliveryClientEmail] = useState<string>(clientEmail ?? '');
  const [deliveredUrl, setDeliveredUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(preset ?? makeDefaultPreset());
    setRunning(false);
    setProgress(null);
    setError(null);
    setDeliveredUrl(null);
    setDeliveryClientName(clientName ?? '');
    setDeliveryClientEmail(clientEmail ?? '');
  }, [open, preset, clientName, clientEmail]);

  const samplePreviews = useMemo(() => {
    const sample = images.slice(0, 3);
    const extension = extensionForFormat(draft.format);
    return sample.map((image, index) =>
      renderFilename(
        draft.filenameTemplate || DEFAULT_TEMPLATE,
        {
          originalName: image.fileName,
          sequence: image.sequence > 0 ? image.sequence : index + 1,
          projectName,
          clientName,
          customText: undefined,
        },
        { extension },
      ),
    );
  }, [draft.filenameTemplate, draft.format, images, projectName, clientName]);

  const updateResize = (resize: ExportResize) => setDraft((d) => ({ ...d, resize }));

  const insertToken = (token: string) => {
    setDraft((d) => ({ ...d, filenameTemplate: `${d.filenameTemplate}${token}` }));
  };

  const handleSavePreset = () => {
    if (!draft.name.trim()) return;
    onSavePreset({ ...draft, name: draft.name.trim() });
  };

  const handleExport = async (bundleAsZip: boolean) => {
    setRunning(true);
    setError(null);
    setProgress({ done: 0, total: images.length, currentFilename: '' });
    try {
      const results = await renderPresetForImages(
        images,
        draft,
        { projectName, clientName },
        (p) => setProgress(p),
      );
      if (results.length === 0) {
        setError('Ingen bilder i sesjonen å eksportere.');
        return;
      }
      if (bundleAsZip && results.length > 1) {
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        for (const r of results) {
          zip.file(r.filename, r.blob);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        const zipName = `${(projectName || 'export').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.zip`;
        triggerDownload(blob, zipName);
      } else {
        for (const r of results) {
          triggerDownload(r.blob, r.filename);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eksport feilet.');
    } finally {
      setRunning(false);
    }
  };

  const deliveryReady =
    Boolean(photographerId) &&
    deliveryClientName.trim().length > 0 &&
    /@/.test(deliveryClientEmail.trim()) &&
    images.length > 0;

  /**
   * Render every image through the export pipeline, then POST them as
   * multipart to `/api/photo-enhancer/deliveries/client-gallery`. On
   * success we latch the returned share URL into state so the
   * photographer has something to copy + share with the bakery.
   */
  const handleDeliver = async () => {
    setRunning(true);
    setError(null);
    setDeliveredUrl(null);
    setProgress({ done: 0, total: images.length, currentFilename: '' });
    try {
      const results = await renderPresetForImages(
        images,
        draft,
        { projectName, clientName: deliveryClientName },
        (p) => setProgress(p),
      );
      if (results.length === 0) {
        setError('Ingen bilder i sesjonen å levere.');
        return;
      }
      const form = new FormData();
      form.append('ownerUserId', photographerId!);
      form.append('clientName', deliveryClientName.trim());
      form.append('clientEmail', deliveryClientEmail.trim());
      form.append(
        'projectTitle',
        (projectName?.trim() || draft.name || 'Levering').slice(0, 200),
      );
      for (const r of results) {
        form.append('images', r.blob, r.filename);
        form.append('titles', r.filename.replace(/\.[^.]+$/, ''));
      }
      const response = await fetch('/api/photo-enhancer/deliveries/client-gallery', {
        method: 'POST',
        body: form,
      });
      const body = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        shareUrl?: string;
        error?: string;
        detail?: string;
      };
      if (!response.ok || !body.success || !body.shareUrl) {
        throw new Error(
          body.error
            ? `${body.error}${body.detail ? ` (${body.detail})` : ''}`
            : `HTTP ${response.status}`,
        );
      }
      setDeliveredUrl(body.shareUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Levering feilet.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onClose={running ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <span>Eksport-preset</span>
          <IconButton size="small" onClick={onClose} disabled={running}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <TextField
                size="small"
                label="Preset-navn"
                value={draft.name}
                onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
              />

              <FormControl size="small">
                <InputLabel id="export-format-label">Format</InputLabel>
                <Select
                  labelId="export-format-label"
                  label="Format"
                  value={draft.format}
                  onChange={(event) => setDraft((d) => ({ ...d, format: event.target.value as ExportPreset['format'] }))}
                >
                  <MenuItem value="jpeg">JPEG</MenuItem>
                  <MenuItem value="png">PNG (8-bit)</MenuItem>
                  <MenuItem value="png-16bit">PNG (16-bit, arkiv)</MenuItem>
                  <MenuItem value="webp">WebP</MenuItem>
                </Select>
              </FormControl>

              <TextField
                size="small"
                label="Kvalitet"
                type="number"
                disabled={draft.format === 'png' || draft.format === 'png-16bit'}
                value={draft.quality}
                onChange={(event) => {
                  const n = Number(event.target.value);
                  setDraft((d) => ({ ...d, quality: Number.isFinite(n) ? Math.max(1, Math.min(100, n)) : d.quality }));
                }}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              />

              <FormControl size="small">
                <InputLabel id="export-crop-label">Beskjæring</InputLabel>
                <Select
                  labelId="export-crop-label"
                  label="Beskjæring"
                  value={cropSelectValue(draft.crop)}
                  onChange={(event) => {
                    const v = event.target.value as
                      | ExportCropAspect
                      | 'custom';
                    if (v === 'custom') {
                      // Keep any existing custom object or seed sensible defaults.
                      const current =
                        typeof draft.crop === 'object' ? draft.crop : { w: 16, h: 9 };
                      setDraft((d) => ({ ...d, crop: current }));
                    } else {
                      setDraft((d) => ({ ...d, crop: v === 'none' ? undefined : v }));
                    }
                  }}
                >
                  {EXPORT_CROP_ASPECTS.map((aspect) => (
                    <MenuItem key={aspect} value={aspect}>
                      {describeCropAspect(aspect)}
                    </MenuItem>
                  ))}
                  <MenuItem value="custom">Egendefinert …</MenuItem>
                </Select>
              </FormControl>

              {typeof draft.crop === 'object' && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    label="Bredde"
                    type="number"
                    value={draft.crop.w}
                    onChange={(event) => {
                      const n = Number(event.target.value);
                      if (!Number.isFinite(n) || n <= 0) return;
                      setDraft((d) => {
                        const prev = typeof d.crop === 'object' ? d.crop : { w: 16, h: 9 };
                        return { ...d, crop: { w: n, h: prev.h } };
                      });
                    }}
                    sx={{ width: 96 }}
                  />
                  <Typography variant="body2">:</Typography>
                  <TextField
                    size="small"
                    label="Høyde"
                    type="number"
                    value={draft.crop.h}
                    onChange={(event) => {
                      const n = Number(event.target.value);
                      if (!Number.isFinite(n) || n <= 0) return;
                      setDraft((d) => {
                        const prev = typeof d.crop === 'object' ? d.crop : { w: 16, h: 9 };
                        return { ...d, crop: { w: prev.w, h: n } };
                      });
                    }}
                    sx={{ width: 96 }}
                  />
                </Stack>
              )}

              <FormControl size="small">
                <InputLabel id="export-resize-label">Skalering</InputLabel>
                <Select
                  labelId="export-resize-label"
                  label="Skalering"
                  value={draft.resize.mode}
                  onChange={(event) => {
                    const mode = event.target.value as ExportResize['mode'];
                    if (mode === 'none') updateResize({ mode: 'none' });
                    else if (mode === 'percent') updateResize({ mode: 'percent', percent: 100 });
                    else updateResize({ mode, pixels: 2000 });
                  }}
                >
                  <MenuItem value="none">Ingen</MenuItem>
                  <MenuItem value="long_edge">Lang side</MenuItem>
                  <MenuItem value="short_edge">Kort side</MenuItem>
                  <MenuItem value="width">Bredde</MenuItem>
                  <MenuItem value="height">Høyde</MenuItem>
                  <MenuItem value="percent">Prosent</MenuItem>
                </Select>
              </FormControl>

              {draft.resize.mode !== 'none' && (
                <TextField
                  size="small"
                  label={draft.resize.mode === 'percent' ? 'Prosent' : 'Piksler'}
                  type="number"
                  value={draft.resize.mode === 'percent' ? draft.resize.percent : draft.resize.pixels}
                  onChange={(event) => {
                    const n = Number(event.target.value);
                    if (!Number.isFinite(n)) return;
                    if (draft.resize.mode === 'percent') {
                      updateResize({ mode: 'percent', percent: Math.max(1, Math.min(100, n)) });
                    } else if (draft.resize.mode !== 'none') {
                      updateResize({ mode: draft.resize.mode, pixels: Math.max(64, Math.round(n)) });
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        {draft.resize.mode === 'percent' ? '%' : 'px'}
                      </InputAdornment>
                    ),
                  }}
                />
              )}

              <FormControl size="small">
                <InputLabel id="export-sharpen-label">Skarphet</InputLabel>
                <Select
                  labelId="export-sharpen-label"
                  label="Skarphet"
                  value={draft.sharpen ?? 'none'}
                  onChange={(event) =>
                    setDraft((d) => ({
                      ...d,
                      sharpen: event.target.value as SharpenLevel,
                    }))
                  }
                >
                  {SHARPEN_LEVELS.map((level) => (
                    <MenuItem key={level} value={level}>
                      {describeSharpenLevel(level)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small">
                <InputLabel id="export-colorspace-label">Fargerom</InputLabel>
                <Select
                  labelId="export-colorspace-label"
                  label="Fargerom"
                  value={draft.colorSpace}
                  onChange={(event) => setDraft((d) => ({ ...d, colorSpace: event.target.value as ExportPreset['colorSpace'] }))}
                >
                  <MenuItem value="srgb">sRGB (anbefalt for web)</MenuItem>
                  <MenuItem value="display-p3">Display-P3</MenuItem>
                </Select>
              </FormControl>

              <TextField
                size="small"
                label="Copyright"
                placeholder="© 2026 Daniel Beckmann / CreatorHub"
                value={draft.metadata?.copyright ?? ''}
                onChange={(event) =>
                  setDraft((d) => ({
                    ...d,
                    metadata: { ...(d.metadata ?? {}), copyright: event.target.value },
                  }))
                }
                helperText="Stamples inn i EXIF/IPTC/XMP av backend. La stå tom for anonyme filer."
              />
            </Stack>
          </Grid>

          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Box>
                <TextField
                  fullWidth
                  size="small"
                  label="Filnavn-mal"
                  value={draft.filenameTemplate}
                  onChange={(event) => setDraft((d) => ({ ...d, filenameTemplate: event.target.value }))}
                  placeholder={DEFAULT_TEMPLATE}
                />
                <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  {AVAILABLE_TOKENS.map((token) => (
                    <Tooltip key={token} title="Sett inn i malen">
                      <Chip
                        size="small"
                        label={token}
                        variant="outlined"
                        clickable
                        onClick={() => insertToken(token)}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              </Box>

              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="caption" color="text.secondary">
                  Forhåndsvisning av filnavn (første {samplePreviews.length} av {images.length})
                </Typography>
                <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                  {samplePreviews.length === 0 ? (
                    <Typography variant="caption" color="text.disabled">
                      Last opp bilder for å se filnavn.
                    </Typography>
                  ) : (
                    samplePreviews.map((name, i) => (
                      <Typography key={i} variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {name}
                      </Typography>
                    ))
                  )}
                </Stack>
              </Paper>

              <Divider />

              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={!!draft.watermark}
                    onChange={(event) =>
                      setDraft((d) => ({
                        ...d,
                        watermark: event.target.checked
                          ? d.watermark ?? { text: clientName || projectName || 'CreatorHub', opacity: 0.5, position: 'bottom-right' }
                          : undefined,
                      }))
                    }
                  />
                }
                label="Vannmerke"
              />
              {draft.watermark && (
                <Stack spacing={1}>
                  <TextField
                    size="small"
                    label="Vannmerke-tekst"
                    value={draft.watermark.text}
                    onChange={(event) =>
                      setDraft((d) =>
                        d.watermark ? { ...d, watermark: { ...d.watermark, text: event.target.value } } : d,
                      )
                    }
                  />
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      label="Opasitet"
                      type="number"
                      value={Math.round(draft.watermark.opacity * 100)}
                      onChange={(event) => {
                        const n = Number(event.target.value);
                        if (!Number.isFinite(n)) return;
                        setDraft((d) =>
                          d.watermark
                            ? { ...d, watermark: { ...d.watermark, opacity: Math.max(0, Math.min(1, n / 100)) } }
                            : d,
                        );
                      }}
                      InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                    />
                    <FormControl size="small" sx={{ flex: 1 }}>
                      <InputLabel id="watermark-pos-label">Posisjon</InputLabel>
                      <Select
                        labelId="watermark-pos-label"
                        label="Posisjon"
                        value={draft.watermark.position}
                        onChange={(event) =>
                          setDraft((d) =>
                            d.watermark
                              ? { ...d, watermark: { ...d.watermark, position: event.target.value as ExportWatermark['position'] } }
                              : d,
                          )
                        }
                      >
                        {WATERMARK_POSITIONS.map((pos) => (
                          <MenuItem key={pos} value={pos}>
                            {pos}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                </Stack>
              )}
            </Stack>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {running && progress && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
            />
            <Typography variant="caption" color="text.secondary">
              Rendrer {progress.done + 1}/{progress.total}: {progress.currentFilename || '…'}
            </Typography>
          </Box>
        )}
      </DialogContent>
      {photographerId && (
        <Box sx={{ px: 3, pb: 1 }}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Lever direkte til klientgalleri
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <TextField
              size="small"
              label="Klientnavn"
              value={deliveryClientName}
              onChange={(event) => setDeliveryClientName(event.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Klient-epost"
              type="email"
              value={deliveryClientEmail}
              onChange={(event) => setDeliveryClientEmail(event.target.value)}
              sx={{ flex: 1 }}
            />
          </Stack>
          {deliveredUrl && (
            <Alert severity="success" sx={{ mb: 1 }}>
              <Typography variant="body2">
                Galleriet er opprettet. Del denne URLen med kunden:
              </Typography>
              <Typography
                variant="body2"
                component="a"
                href={deliveredUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ wordBreak: 'break-all', fontFamily: 'monospace' }}
              >
                {deliveredUrl}
              </Typography>
            </Alert>
          )}
        </Box>
      )}
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1}>
          {onDeletePreset && preset && (
            <Button color="error" onClick={() => onDeletePreset(preset.id)} disabled={running}>
              Slett preset
            </Button>
          )}
          <Button startIcon={<SaveIcon />} onClick={handleSavePreset} disabled={running || !draft.name.trim()}>
            Lagre preset
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button onClick={onClose} disabled={running}>
            Lukk
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => void handleExport(false)}
            disabled={running || images.length === 0}
          >
            Last ned enkeltvis
          </Button>
          <Button
            variant="outlined"
            startIcon={<InventoryIcon />}
            onClick={() => void handleExport(true)}
            disabled={running || images.length === 0}
          >
            Eksporter som ZIP
          </Button>
          {photographerId && (
            <Button
              variant="contained"
              onClick={() => void handleDeliver()}
              disabled={running || !deliveryReady}
            >
              Lever til klientgalleri
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

function makeDefaultPreset(): ExportPreset {
  return {
    id: `preset_${Date.now().toString(36)}`,
    name: 'Web 2000',
    format: 'jpeg',
    quality: 85,
    resize: { mode: 'long_edge', pixels: 2000 },
    colorSpace: 'srgb',
    filenameTemplate: DEFAULT_TEMPLATE,
  };
}
