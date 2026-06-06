/**
 * WeeklyBriefEditor — Admin Room modal for å redigere og eksportere
 * Weekly Brief marketing-posters. Live preview, variant-picker, PNG-eksport
 * via html2canvas mot off-screen 1080-bred mount (→ 1080×1350 ved 4:5).
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
import html2canvas from 'html2canvas';
import {
  WeeklyBriefPoster,
  WEEKLY_BRIEF_VARIANTS,
  CARD_ICON_OPTIONS,
  type WeeklyBriefCard,
  type WeeklyBriefCardIcon,
  type WeeklyBriefFields,
  type WeeklyBriefVariant,
  type SocialIcon,
} from './WeeklyBriefPoster';

const SOCIAL_OPTIONS: SocialIcon[] = ['linkedin', 'instagram', 'youtube', 'email'];

const DEFAULT_FIELDS: WeeklyBriefFields = {
  headline: 'Weekly\nNorwegian\nCasting Brief',
  accentText: 'Norwegian',
  subheading: 'Innsikt, trender og verktøy for produsenter, castingredaktører og talent.',
  subheadingHighlights: ['produsenter', 'castingredaktører', 'talent'],
  cards: [
    {
      icon: 'chart',
      title: 'Ukens datapunkt',
      description: 'Nøkkeltall og trender fra casting- og produksjonslandskapet akkurat nå.',
    },
    {
      icon: 'film',
      title: 'Bak kulissene',
      description: 'Innsikt fra faktiske produksjoner og hva som skjer bak scenen.',
    },
    {
      icon: 'shield',
      title: 'Compliance alert',
      description: 'Viktige oppdateringer om lover, regler og bransjestandarder.',
    },
    {
      icon: 'person',
      title: 'Founder POV',
      description: 'Refleksjoner, erfaringer og perspektiver fra grunnleggeren.',
    },
  ],
  ctaTitle: 'Abonner for ukentlig innsikt',
  ctaTitleAccent: 'ukentlig innsikt',
  ctaSubtitle: 'Hold deg oppdatert. Ta bedre beslutninger. Bygg sterkere produksjoner.',
  qrUrl: 'https://theroleroom.no/abonner',
  footerLeft: 'theroleroom.no',
  footerCenter: 'Casting. Roles. Together.',
  socialIcons: ['linkedin', 'instagram', 'youtube'],
};

export interface WeeklyBriefEditorProps {
  open: boolean;
  /** Init-felter — typisk DEFAULT_FIELDS, kan overstyres ved gjenåpning */
  initialFields?: Partial<WeeklyBriefFields>;
  onClose: () => void;
}

export const WeeklyBriefEditor: React.FC<WeeklyBriefEditorProps> = ({
  open,
  initialFields,
  onClose,
}) => {
  const [fields, setFields] = useState<WeeklyBriefFields>({ ...DEFAULT_FIELDS, ...initialFields });
  const [variant, setVariant] = useState<WeeklyBriefVariant>('standard');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFields({ ...DEFAULT_FIELDS, ...initialFields });
    setVariant('standard');
    setError(null);
  }, [open, initialFields]);

  const exportRef = useRef<HTMLDivElement | null>(null);

  const downloadFileName = useMemo(() => {
    const safe = fields.headline
      .toLowerCase()
      .replace(/[^a-z0-9æøå]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'weekly-brief';
    return `${safe}.png`;
  }, [fields.headline]);

  const handleExport = async (): Promise<void> => {
    if (!exportRef.current) return;
    setExporting(true);
    setError(null);
    try {
      // QR-koden trenger en tick på å mounte (useEffect i WeeklyBriefPoster);
      // gi den litt slack før vi snapshotter.
      await new Promise((r) => setTimeout(r, 300));
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: null,
        scale: 1,
        useCORS: true,
        logging: false,
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png', 0.95),
      );
      if (!blob) throw new Error('PNG-eksport feilet');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(`PNG-eksport feilet: ${(err as Error).message}`);
    } finally {
      setExporting(false);
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
            Weekly Brief — newsletter-poster
          </Typography>
          <Chip size="small" label="4:5 · PNG · LinkedIn/IG feed" sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: '#ddd6fe' }} />
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
                {WEEKLY_BRIEF_VARIANTS.map((v) => (
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
                {WEEKLY_BRIEF_VARIANTS.find((v) => v.id === variant)?.description}
              </Typography>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
              HEADLINE
            </Typography>
            <TextField
              size="small"
              label="Headline (bryt linjer med Enter — \\n)"
              value={fields.headline}
              onChange={(e) => setFields({ ...fields, headline: e.target.value })}
              multiline
              minRows={2}
              fullWidth
              helperText='Eks: "Weekly\\nNorwegian\\nCasting Brief"'
            />
            <TextField
              size="small"
              label="Accent-ord (lilla gradient i headline)"
              value={fields.accentText ?? ''}
              onChange={(e) => setFields({ ...fields, accentText: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label="Underlinje"
              value={fields.subheading ?? ''}
              onChange={(e) => setFields({ ...fields, subheading: e.target.value })}
              multiline
              minRows={2}
              fullWidth
            />
            <TextField
              size="small"
              label="Highlights i underlinje (kommaseparert)"
              value={(fields.subheadingHighlights ?? []).join(', ')}
              onChange={(e) =>
                setFields({
                  ...fields,
                  subheadingHighlights: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              fullWidth
              helperText='Ord som farges lilla i underlinjen — case-sensitive.'
            />

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
              CONTENT-CARDS (1-4 stk; minimal-varianten skjuler alle)
            </Typography>
            {fields.cards.map((card, i) => (
              <CardRow
                key={i}
                card={card}
                onChange={(next) => setFields({ ...fields, cards: fields.cards.map((c, j) => (j === i ? next : c)) })}
                onRemove={() => setFields({ ...fields, cards: fields.cards.filter((_, j) => j !== i) })}
              />
            ))}
            {fields.cards.length < 4 && (
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() =>
                  setFields({
                    ...fields,
                    cards: [...fields.cards, { icon: 'star', title: '', description: '' }],
                  })
                }
              >
                Legg til card
              </Button>
            )}

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
              ABONNEMENT + QR
            </Typography>
            <TextField
              size="small"
              label="CTA-tittel"
              value={fields.ctaTitle ?? ''}
              onChange={(e) => setFields({ ...fields, ctaTitle: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label="CTA-accent (markeres lilla)"
              value={fields.ctaTitleAccent ?? ''}
              onChange={(e) => setFields({ ...fields, ctaTitleAccent: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label="CTA-undertekst"
              value={fields.ctaSubtitle ?? ''}
              onChange={(e) => setFields({ ...fields, ctaSubtitle: e.target.value })}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              size="small"
              label="QR-URL (genererer QR-kode automatisk)"
              value={fields.qrUrl ?? ''}
              onChange={(e) => setFields({ ...fields, qrUrl: e.target.value })}
              fullWidth
              placeholder="https://theroleroom.no/abonner"
            />

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
              FOOTER
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Footer venstre"
                value={fields.footerLeft ?? ''}
                onChange={(e) => setFields({ ...fields, footerLeft: e.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="Footer midt"
                value={fields.footerCenter ?? ''}
                onChange={(e) => setFields({ ...fields, footerCenter: e.target.value })}
                fullWidth
              />
            </Stack>
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>Sosial-ikoner</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 1 }}>
                {SOCIAL_OPTIONS.map((s) => {
                  const active = (fields.socialIcons ?? []).includes(s);
                  return (
                    <Chip
                      key={s}
                      label={s}
                      clickable
                      onClick={() => {
                        const current = fields.socialIcons ?? [];
                        const next = active ? current.filter((x) => x !== s) : [...current, s];
                        setFields({ ...fields, socialIcons: next });
                      }}
                      sx={{
                        bgcolor: active ? 'rgba(167,139,250,0.30)' : 'rgba(255,255,255,0.05)',
                        color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                        fontWeight: 700,
                      }}
                    />
                  );
                })}
              </Stack>
            </Box>
          </Stack>

          {/* Preview */}
          <Stack spacing={1.5} alignItems="center">
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
              LIVE PREVIEW
            </Typography>
            <Box sx={{ width: '100%', maxWidth: 380 }}>
              <WeeklyBriefPoster fields={fields} variant={variant} />
            </Box>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              Eksport rendres i 1080 × 1350 px (LinkedIn 4:5 / Instagram feed).
            </Typography>
          </Stack>
        </Box>

        {/* Skjult off-screen poster for 1080-bred eksport */}
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
          <WeeklyBriefPoster fields={fields} width={1080} variant={variant} ref={exportRef} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>Lukk</Button>
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

interface CardRowProps {
  card: WeeklyBriefCard;
  onChange: (next: WeeklyBriefCard) => void;
  onRemove: () => void;
}

function CardRow({ card, onChange, onRemove }: CardRowProps): JSX.Element {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: '1px solid rgba(167,139,250,0.18)',
        bgcolor: 'rgba(167,139,250,0.04)',
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1}>
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel>Ikon</InputLabel>
            <Select
              label="Ikon"
              value={card.icon}
              onChange={(e) => onChange({ ...card, icon: e.target.value as WeeklyBriefCardIcon })}
            >
              {CARD_ICON_OPTIONS.map((k) => (
                <MenuItem key={k} value={k}>{k}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Tittel"
            value={card.title}
            onChange={(e) => onChange({ ...card, title: e.target.value })}
            fullWidth
          />
          <IconButton size="small" onClick={onRemove}>
            <DeleteOutlineIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.5)' }} />
          </IconButton>
        </Stack>
        <TextField
          size="small"
          label="Beskrivelse (1-2 linjer)"
          value={card.description}
          onChange={(e) => onChange({ ...card, description: e.target.value })}
          fullWidth
          multiline
          minRows={2}
        />
      </Stack>
    </Box>
  );
}

export default WeeklyBriefEditor;
