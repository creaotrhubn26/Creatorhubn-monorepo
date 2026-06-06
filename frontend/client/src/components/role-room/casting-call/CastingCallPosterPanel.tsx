/**
 * CastingCallPosterPanel — modal som tar en (delvis) rolle + prosjekt og lar
 * brukeren tilpasse alle felt før eksport. Live preview rendres med
 * CastingCallPoster; PNG-eksport gjøres via html2canvas på et off-screen
 * poster mounted i 1080px bredde (= 1080×1920 ved 9:16).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import html2canvas from 'html2canvas';
import {
  CastingCallPoster,
  CASTING_CALL_POSTER_VARIANTS,
  POSTER_STAT_ICON_OPTIONS,
  type CastingCallPosterVariant,
  type PosterFields,
  type PosterStat,
  type PosterStatIcon,
} from './CastingCallPoster';

export interface CastingCallPosterSource {
  /** Rolle-navnet — vises som lilla headline */
  roleName: string;
  /** Produksjon (project.name) */
  productionName?: string;
  /** Format — feature film / TV series / kortfilm osv. */
  format?: string;
  /** Sjanger (project.genre) */
  genre?: string;
  /** Aldersgruppe ("25-35") */
  ageRange?: string;
  /** Lokasjon (by + land) */
  location?: string;
  /** Auditionfrist (dato eller fritekst) */
  auditionDeadline?: string;
  /** Status-felt — typisk "Verified casting" */
  status?: string;
  /** Sitat (typisk role.description i kort form) */
  quote?: string;
  /** Apply-URL (vises ikke i poster — bare for delelink) */
  applyUrl?: string;
  /** Prosjekt-ID (brukt i B2-arkivnøkkel hvis admin er innlogget) */
  projectId?: string;
  /** Rolle-ID (brukt i B2-arkivnøkkel hvis admin er innlogget) */
  roleId?: string;
}

interface CastingCallPosterPanelProps {
  open: boolean;
  source: CastingCallPosterSource;
  onClose: () => void;
}

function defaultStatsFromSource(s: CastingCallPosterSource): PosterStat[] {
  const grid: PosterStat[] = [
    { label: 'PRODUKSJON', value: s.productionName ?? '', icon: 'production' },
    { label: 'FORMAT', value: s.format ?? '', icon: 'format' },
    { label: 'SJANGER', value: s.genre ?? '', icon: 'genre' },
    { label: 'ALDER', value: s.ageRange ?? '', icon: 'age' },
    { label: 'LOKASJON', value: s.location ?? '', icon: 'location' },
    { label: 'AUDITIONFRIST', value: s.auditionDeadline ?? '', icon: 'calendar' },
  ];
  const statusValue = (s.status ?? '').trim();
  if (statusValue.length > 0) {
    grid.push({
      label: 'STATUS',
      value: statusValue,
      icon: 'shield',
      fullWidth: true,
      verifiedBadge: /verified/i.test(statusValue),
    });
  }
  return grid;
}

export const CastingCallPosterPanel: React.FC<CastingCallPosterPanelProps> = ({
  open,
  source,
  onClose,
}) => {
  const [fields, setFields] = useState<PosterFields>(() => ({
    badge: 'CASTING CALL',
    headline: 'Open role',
    roleName: source.roleName,
    stats: defaultStatsFromSource(source),
    quote: source.quote,
    ctaLabel: 'Apply now',
    applyUrl: source.applyUrl,
    tagline: 'Casting. Roles. Together.',
    footerVerified: 'Verified by The Role Room',
  }));
  const [variant, setVariant] = useState<CastingCallPosterVariant>('standard');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  // Re-syncer felter når dialog åpnes med nytt rolle-input
  useEffect(() => {
    if (!open) return;
    setFields({
      badge: 'CASTING CALL',
      headline: 'Open role',
      roleName: source.roleName,
      stats: defaultStatsFromSource(source),
      quote: source.quote,
      ctaLabel: 'Apply now',
      applyUrl: source.applyUrl,
      tagline: 'Casting. Roles. Together.',
      footerVerified: 'Verified by The Role Room',
    });
    setError(null);
    setCopiedShareLink(false);
    setVariant('standard');
  }, [open, source]);

  // Off-screen full-størrelse poster for høyoppløselig eksport.
  const exportRef = useRef<HTMLDivElement | null>(null);

  const downloadFileName = useMemo(() => {
    const safe = fields.roleName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'role';
    return `casting-call-${safe}.png`;
  }, [fields.roleName]);

  const handleExport = async (): Promise<void> => {
    if (!exportRef.current) return;
    setExporting(true);
    setError(null);
    try {
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: null,
        scale: 1, // 1080-bred allerede, 2 ville gitt 2160 (overkill for sosial-media)
        useCORS: true,
        logging: false,
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png', 0.95),
      );
      if (!blob) throw new Error('PNG-eksport feilet');

      // Browser-download (uendret UX)
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      // Fire-and-forget B2-arkivering. Hvis admin er innlogget +
      // B2 er konfigurert lagres posteren til
      // casting-call-posters/{projectId}/{roleId}-{variant}.png.
      // Feiler stille for ikke-admin-brukere (403 ignoreres).
      try {
        const form = new FormData();
        form.append('poster', blob, downloadFileName);
        form.append('projectId', source.projectId ?? source.productionName ?? 'ukjent-prosjekt');
        form.append('roleId', source.roleId ?? source.roleName);
        form.append('variant', variant);
        void fetch('/api/role-room/admin/casting-posters/save', {
          method: 'POST',
          body: form,
        }).catch(() => {
          /* ignore — arkiv er ikke-kritisk for poster-eksport */
        });
      } catch {
        /* ignore — arkiv er ikke-kritisk for poster-eksport */
      }
    } catch (err) {
      setError(`PNG-eksport feilet: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyShareLink = async (): Promise<void> => {
    const url = (fields.applyUrl ?? '').trim();
    if (!url) {
      setError('Sett en Apply-URL i Avansert før du kopierer delelink.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2000);
    } catch {
      setError('Kunne ikke kopiere — prøv manuelt fra Avansert-feltet.');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{ paper: { sx: { bgcolor: '#0f0f1a', color: '#fff' } } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Del som casting call
          </Typography>
          <Chip size="small" label="9:16 · PNG · Story/Reel" sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: '#ddd6fe' }} />
        </Stack>
        <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
        )}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' },
            gap: 3,
          }}
        >
          {/* Edit form */}
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
                LAYOUT-VARIANT
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 1 }}>
                {CASTING_CALL_POSTER_VARIANTS.map((v) => (
                  <Chip
                    key={v.id}
                    label={v.label}
                    clickable
                    onClick={() => setVariant(v.id)}
                    sx={{
                      bgcolor: variant === v.id ? 'rgba(167,139,250,0.30)' : 'rgba(255,255,255,0.05)',
                      color: variant === v.id ? '#fff' : 'rgba(255,255,255,0.7)',
                      fontWeight: 700,
                      border: variant === v.id ? '1px solid rgba(167,139,250,0.65)' : '1px solid transparent',
                    }}
                  />
                ))}
              </Stack>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mt: 0.5 }}>
                {CASTING_CALL_POSTER_VARIANTS.find((v) => v.id === variant)?.description}
              </Typography>
            </Box>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
              REDIGER FELTER
            </Typography>
            <TextField
              size="small"
              label="Rolle-navn (lilla headline)"
              value={fields.roleName}
              onChange={(e) => setFields({ ...fields, roleName: e.target.value })}
              fullWidth
            />
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Badge"
                value={fields.badge ?? ''}
                onChange={(e) => setFields({ ...fields, badge: e.target.value })}
              />
              <TextField
                size="small"
                label="Headline (over rolle)"
                value={fields.headline ?? ''}
                onChange={(e) => setFields({ ...fields, headline: e.target.value })}
                fullWidth
              />
            </Stack>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
              FAKTA-GRID
            </Typography>
            {fields.stats.map((stat, i) => (
              <StatRow
                key={i}
                stat={stat}
                onChange={(next) =>
                  setFields({ ...fields, stats: fields.stats.map((s, j) => (j === i ? next : s)) })
                }
                onRemove={() => setFields({ ...fields, stats: fields.stats.filter((_, j) => j !== i) })}
              />
            ))}
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() =>
                setFields({
                  ...fields,
                  stats: [
                    ...fields.stats,
                    { label: '', value: '', icon: 'production', fullWidth: false },
                  ],
                })
              }
            >
              Legg til felt
            </Button>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
            <TextField
              size="small"
              label="Sitat (vises i quote-blokk)"
              multiline
              minRows={3}
              value={fields.quote ?? ''}
              onChange={(e) => setFields({ ...fields, quote: e.target.value })}
              fullWidth
              helperText="La stå tom for å skjule sitat-blokken"
            />
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="CTA-tekst"
                value={fields.ctaLabel ?? ''}
                onChange={(e) => setFields({ ...fields, ctaLabel: e.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="Apply-URL"
                value={fields.applyUrl ?? ''}
                onChange={(e) => setFields({ ...fields, applyUrl: e.target.value })}
                placeholder="https://theroleroom.com/r/..."
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Tagline"
                value={fields.tagline ?? ''}
                onChange={(e) => setFields({ ...fields, tagline: e.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="Footer (verified-tekst)"
                value={fields.footerVerified ?? ''}
                onChange={(e) => setFields({ ...fields, footerVerified: e.target.value })}
                fullWidth
              />
            </Stack>
          </Stack>

          {/* Preview */}
          <Stack spacing={1.5} alignItems="center">
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
              LIVE PREVIEW
            </Typography>
            <Box sx={{ width: '100%', maxWidth: 360 }}>
              <CastingCallPoster fields={fields} variant={variant} />
            </Box>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              Eksport rendres i 1080 × 1920 px (samme som Instagram Story / Reel cover).
            </Typography>
          </Stack>
        </Box>

        {/* Skjult off-screen poster på full 1080-bredde for eksport */}
        <Box
          sx={{
            position: 'fixed',
            top: -99999,
            left: -99999,
            width: 1080,
            pointerEvents: 'none',
          }}
          aria-hidden
        >
          <CastingCallPoster fields={fields} width={1080} variant={variant} ref={exportRef} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Button
          startIcon={copiedShareLink ? null : <ContentCopyIcon />}
          onClick={() => { void handleCopyShareLink(); }}
          sx={{ color: 'rgba(255,255,255,0.7)' }}
        >
          {copiedShareLink ? 'Lenke kopiert ✓' : 'Kopier delelink'}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>Avbryt</Button>
        <Button
          variant="contained"
          startIcon={exporting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <DownloadIcon />}
          disabled={exporting}
          onClick={() => { void handleExport(); }}
          sx={{ bgcolor: '#7c3aed', fontWeight: 700, textTransform: 'none' }}
        >
          {exporting ? 'Eksporterer…' : 'Last ned PNG'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface StatRowProps {
  stat: PosterStat;
  onChange: (next: PosterStat) => void;
  onRemove: () => void;
}

function StatRow({ stat, onChange, onRemove }: StatRowProps): JSX.Element {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <InputLabel>Ikon</InputLabel>
        <Select
          label="Ikon"
          value={stat.icon ?? 'production'}
          onChange={(e) => onChange({ ...stat, icon: e.target.value as PosterStatIcon })}
        >
          {POSTER_STAT_ICON_OPTIONS.map((k) => (
            <MenuItem key={k} value={k}>{k}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        size="small"
        label="Felt"
        value={stat.label}
        onChange={(e) => onChange({ ...stat, label: e.target.value })}
        sx={{ width: 160 }}
      />
      <TextField
        size="small"
        label="Verdi"
        value={stat.value}
        onChange={(e) => onChange({ ...stat, value: e.target.value })}
        fullWidth
      />
      <Chip
        size="small"
        clickable
        label={stat.fullWidth ? 'Full bredde' : 'Halv bredde'}
        onClick={() => onChange({ ...stat, fullWidth: !stat.fullWidth })}
        sx={{
          bgcolor: stat.fullWidth ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.05)',
          color: stat.fullWidth ? '#ddd6fe' : 'rgba(255,255,255,0.7)',
        }}
      />
      <Chip
        size="small"
        clickable
        label={stat.verifiedBadge ? '✓ badge' : '− badge'}
        onClick={() => onChange({ ...stat, verifiedBadge: !stat.verifiedBadge })}
        sx={{
          bgcolor: stat.verifiedBadge ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.05)',
          color: stat.verifiedBadge ? '#ddd6fe' : 'rgba(255,255,255,0.7)',
        }}
      />
      <IconButton size="small" onClick={onRemove}>
        <DeleteOutlineIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.5)' }} />
      </IconButton>
    </Stack>
  );
}

export default CastingCallPosterPanel;
