/**
 * WeeklyBriefEditor — Admin Room modal for å redigere, lagre og eksportere
 * marketing-feed-posters (4:5 PNG for LinkedIn/IG feed).
 *
 * Endringer fra v1:
 *   - Persisterer mot /api/admin-room/marketing-posters (lagre, åpne,
 *     dupliser, slett, liste over tidligere posters)
 *   - Theme-velger (purple / film_warm / dance_pink)
 *   - "Auto-fyll fra siste nyhetsbrev-utgave"-knapp
 *   - Single-mount renderer + scale-factor ved html2canvas (ikke lenger
 *     2x off-screen DOM)
 *   - Await QR-ready før eksport (ingen 300ms-hack)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ImageIcon from '@mui/icons-material/Image';
import html2canvas from 'html2canvas';
import * as htmlToImage from 'html-to-image';
import {
  MarketingFeedPoster,
  POSTER_VARIANTS,
  CARD_ICON_OPTIONS,
  preloadQrCode,
  type MarketingPosterFields,
  type PosterCard,
  type PosterCardIcon,
  type PosterVariant,
  type SocialIcon,
} from './MarketingFeedPoster';
import { THEME_OPTIONS, type MarketingPosterTheme } from './themes';
import { useHistoryState } from './useHistoryState';
import {
  marketingPostersApi,
  newsletterIssuesApi,
  type MarketingPoster,
  type NewsletterIssue,
} from '../../../services/adminRoomApi';

const SOCIAL_OPTIONS: SocialIcon[] = ['linkedin', 'instagram', 'youtube', 'email'];

const DEFAULT_FIELDS: MarketingPosterFields = {
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
  qrUrl: 'https://thetheroleroom.com/abonner',
  footerLeft: 'thetheroleroom.com',
  footerCenter: 'Casting. Roles. Together.',
  socialIcons: ['linkedin', 'instagram', 'youtube'],
};

const PREVIEW_WIDTH = 380;
const EXPORT_WIDTH = 1080;

export interface WeeklyBriefEditorProps {
  open: boolean;
  initialFields?: Partial<MarketingPosterFields>;
  /** Hvis satt åpnes editoren med eksisterende poster lastet. */
  initialPosterId?: string;
  onClose: () => void;
  /** Skru av persistens-knapper (lagre/dupliser/slett) for e2e-isolasjon. */
  hidePersistence?: boolean;
}

export const WeeklyBriefEditor: React.FC<WeeklyBriefEditorProps> = ({
  open,
  initialFields,
  initialPosterId,
  hidePersistence = false,
  onClose,
}) => {
  const [fields, setFields, history] = useHistoryState<MarketingPosterFields>(
    { ...DEFAULT_FIELDS, ...initialFields },
    { cap: 50 },
  );
  const [variant, setVariant] = useState<PosterVariant>('standard');
  const [theme, setTheme] = useState<MarketingPosterTheme>('purple');
  const [title, setTitle] = useState<string>('Untitled poster');
  const [posterId, setPosterId] = useState<string | null>(initialPosterId ?? null);
  const [exporting, setExporting] = useState(false);
  const [exportingSvg, setExportingSvg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [openPickerOpen, setOpenPickerOpen] = useState(false);
  const [savedPosters, setSavedPosters] = useState<MarketingPoster[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);

  // Last DB-default ved første åpning hvis ingen initialPosterId — så
  // admin slipper å skrive samme baseline-tekst hver uke.
  useEffect(() => {
    if (!open) return;
    setVariant('standard');
    setTheme('purple');
    setTitle('Untitled poster');
    setPosterId(initialPosterId ?? null);
    setError(null);
    setInfo(null);
    if (initialPosterId || initialFields) {
      history.reset({ ...DEFAULT_FIELDS, ...initialFields });
      return;
    }
    let cancelled = false;
    void marketingPostersApi.getDefault('weekly_brief')
      .then((dbDefault) => {
        if (cancelled) return;
        if (dbDefault) {
          history.reset({ ...DEFAULT_FIELDS, ...(dbDefault.fields as Partial<MarketingPosterFields>) });
          setTheme((dbDefault.theme as MarketingPosterTheme) ?? 'purple');
          setVariant((dbDefault.variant as PosterVariant) ?? 'standard');
        } else {
          history.reset({ ...DEFAULT_FIELDS });
        }
      })
      .catch(() => {
        if (!cancelled) history.reset({ ...DEFAULT_FIELDS });
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFields, initialPosterId]);

  // ⌘Z / Ctrl+Z = undo, ⌘⇧Z / Ctrl+Y = redo. Kun aktiv når modal er åpen.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      // Ikke fang når brukeren editor tekst i et input — browseren har
      // bedre native undo for tekstfelter.
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const lower = e.key.toLowerCase();
      if (lower === 'z' && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      } else if ((lower === 'z' && e.shiftKey) || lower === 'y') {
        e.preventDefault();
        history.redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, history]);

  // Pre-load QR-kode for fields.qrUrl så cache er varmet til eksport.
  useEffect(() => {
    if (fields.qrUrl) void preloadQrCode(fields.qrUrl);
  }, [fields.qrUrl]);

  const previewRef = useRef<HTMLDivElement | null>(null);

  const downloadFileName = useMemo(() => {
    const safe = fields.headline
      .toLowerCase()
      .replace(/[^a-z0-9æøå]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'weekly-brief';
    return `${safe}.png`;
  }, [fields.headline]);

  const refreshSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      const items = await marketingPostersApi.list();
      setSavedPosters(items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavedLoading(false);
    }
  }, []);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const input = {
        title,
        templateId: 'weekly_brief',
        theme,
        variant,
        fields: fields as unknown as Record<string, unknown>,
      };
      const saved = posterId
        ? await marketingPostersApi.patch(posterId, input)
        : await marketingPostersApi.create(input);
      setPosterId(saved.id);
      setInfo(posterId ? 'Lagret' : 'Opprettet');
      setTimeout(() => setInfo(null), 2000);
    } catch (err) {
      setError(`Kunne ikke lagre: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (): Promise<void> => {
    if (!posterId) {
      setError('Lagre først før du kan duplisere');
      return;
    }
    setSaving(true);
    try {
      const dup = await marketingPostersApi.duplicate(posterId);
      setPosterId(dup.id);
      setTitle(dup.title);
      setInfo(`Duplisert som "${dup.title}"`);
      setTimeout(() => setInfo(null), 2500);
    } catch (err) {
      setError(`Kunne ikke duplisere: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!posterId) return;
    if (!window.confirm(`Slett poster "${title}"?`)) return;
    setSaving(true);
    try {
      await marketingPostersApi.remove(posterId);
      setPosterId(null);
      setTitle('Untitled poster');
      setInfo('Poster slettet');
      setTimeout(() => setInfo(null), 2000);
    } catch (err) {
      setError(`Kunne ikke slette: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSaved = async (poster: MarketingPoster): Promise<void> => {
    setOpenPickerOpen(false);
    try {
      const full = await marketingPostersApi.get(poster.id);
      setPosterId(full.id);
      setTitle(full.title);
      setTheme((full.theme as MarketingPosterTheme) ?? 'purple');
      setVariant((full.variant as PosterVariant) ?? 'standard');
      setFields({ ...DEFAULT_FIELDS, ...(full.fields as Partial<MarketingPosterFields>) });
      setInfo(`Åpnet "${full.title}"`);
      setTimeout(() => setInfo(null), 2000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAutoFill = async (): Promise<void> => {
    setAutoFilling(true);
    setError(null);
    try {
      const issues = await newsletterIssuesApi.list();
      const latest: NewsletterIssue | undefined = issues
        .filter((i) => i.status === 'sent' || i.status === 'draft')
        .sort((a, b) => ((b as unknown as { updated_at?: string }).updated_at ?? '').localeCompare(
          (a as unknown as { updated_at?: string }).updated_at ?? '',
        ))[0];
      if (!latest) {
        setError('Ingen newsletter-utgaver funnet å auto-fylle fra.');
        return;
      }
      // Map newsletter-utgave til poster-felter (snake_case fra backend)
      const blocks = (latest.body_blocks ?? []) as Array<Record<string, unknown>>;
      const cards: PosterCard[] = blocks
        .filter((b) => b.type === 'section' || b.type === 'heading')
        .slice(0, 4)
        .map((b, i) => {
          const sectionText = typeof b.text === 'string' ? b.text : '';
          const sectionTitle = typeof b.title === 'string' ? b.title : `Seksjon ${i + 1}`;
          const iconOrder: PosterCardIcon[] = ['chart', 'film', 'shield', 'person'];
          return {
            icon: iconOrder[i] ?? 'star',
            title: sectionTitle || `Seksjon ${i + 1}`,
            description: sectionText.slice(0, 140) || 'Innhold fra siste utgave.',
          };
        });
      setFields({
        ...fields,
        headline: latest.title || fields.headline,
        cards: cards.length > 0 ? cards : fields.cards,
      });
      setInfo(`Auto-fylt fra: ${latest.title}`);
      setTimeout(() => setInfo(null), 3000);
    } catch (err) {
      setError(`Auto-fyll feilet: ${(err as Error).message}`);
    } finally {
      setAutoFilling(false);
    }
  };

  const handleSetDefault = async (): Promise<void> => {
    setSettingDefault(true);
    setError(null);
    try {
      await marketingPostersApi.setDefault('weekly_brief', {
        title: 'Default weekly_brief',
        theme,
        variant,
        fields: fields as unknown as Record<string, unknown>,
      });
      setInfo('Lagret som default — neste tomme editor-åpning bruker disse verdiene.');
      setTimeout(() => setInfo(null), 4000);
    } catch (err) {
      setError(`Kunne ikke lagre default: ${(err as Error).message}`);
    } finally {
      setSettingDefault(false);
    }
  };

  const handleExportSvg = async (): Promise<void> => {
    if (!previewRef.current) return;
    setExportingSvg(true);
    setError(null);
    try {
      if (fields.qrUrl) await preloadQrCode(fields.qrUrl);
      await new Promise(requestAnimationFrame);
      const dataUrl = await htmlToImage.toSvg(previewRef.current, {
        cacheBust: true,
        // Tving samme størrelse som PNG ved å scale opp via pixelRatio
        pixelRatio: EXPORT_WIDTH / PREVIEW_WIDTH,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = downloadFileName.replace(/\.png$/, '.svg');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setError(`SVG-eksport feilet: ${(err as Error).message}`);
    } finally {
      setExportingSvg(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    if (!previewRef.current) return;
    setExporting(true);
    setError(null);
    try {
      // Await QR-state før snapshot (ingen 300ms-hack)
      if (fields.qrUrl) await preloadQrCode(fields.qrUrl);
      // Vent én tick så React rakk å mounte ferdig QR-img
      await new Promise(requestAnimationFrame);

      const scale = EXPORT_WIDTH / PREVIEW_WIDTH;
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: null,
        scale,
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
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: '#0f0f1a', color: '#fff' } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap" sx={{ rowGap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Marketing-poster
            </Typography>
            <Chip size="small" label="4:5 · PNG · LinkedIn/IG feed" sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: '#ddd6fe' }} />
            {posterId && (
              <Chip
                size="small"
                label={`#${posterId.slice(0, 6)}`}
                sx={{ bgcolor: 'rgba(134,239,172,0.15)', color: '#86efac', fontWeight: 700 }}
              />
            )}
          </Stack>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
          )}
          {info && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo(null)}>{info}</Alert>
          )}

          {/* Top action-bar */}
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
            <TextField
              size="small"
              label="Tittel (intern)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={{ minWidth: 220 }}
            />
            {!hidePersistence && (
              <>
                <Tooltip title="Lagre poster (eller oppdater eksisterende)">
                  <span>
                    <Button
                      data-testid="poster-save"
                      onClick={() => { void handleSave(); }}
                      disabled={saving}
                      startIcon={<SaveIcon />}
                      variant="outlined"
                      sx={{ color: '#86efac', borderColor: 'rgba(134,239,172,0.5)', textTransform: 'none', fontWeight: 700 }}
                    >
                      {saving ? 'Lagrer…' : posterId ? 'Lagre endringer' : 'Lagre ny'}
                    </Button>
                  </span>
                </Tooltip>
                <Button
                  data-testid="poster-duplicate"
                  onClick={() => { void handleDuplicate(); }}
                  disabled={!posterId || saving}
                  startIcon={<ContentCopyIcon />}
                  variant="outlined"
                  sx={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)', textTransform: 'none', fontWeight: 600 }}
                >
                  Dupliser
                </Button>
                <Button
                  data-testid="poster-open"
                  onClick={() => { setOpenPickerOpen(true); void refreshSaved(); }}
                  startIcon={<FolderOpenIcon />}
                  variant="outlined"
                  sx={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)', textTransform: 'none', fontWeight: 600 }}
                >
                  Åpne…
                </Button>
                {posterId && (
                  <Button
                    data-testid="poster-delete"
                    onClick={() => { void handleDelete(); }}
                    disabled={saving}
                    startIcon={<DeleteOutlineIcon />}
                    variant="outlined"
                    sx={{ color: '#fca5a5', borderColor: 'rgba(252,165,165,0.5)', textTransform: 'none', fontWeight: 600 }}
                  >
                    Slett
                  </Button>
                )}
              </>
            )}
            <Button
              data-testid="poster-autofill"
              onClick={() => { void handleAutoFill(); }}
              disabled={autoFilling}
              startIcon={autoFilling ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
              variant="outlined"
              sx={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.5)', textTransform: 'none', fontWeight: 600 }}
            >
              {autoFilling ? 'Auto-fyller…' : 'Auto-fyll fra siste utgave'}
            </Button>
            {!hidePersistence && (
              <Tooltip title="Lagre disse verdiene som default for tom editor (alle templates)">
                <span>
                  <Button
                    data-testid="poster-set-default"
                    onClick={() => { void handleSetDefault(); }}
                    disabled={settingDefault}
                    startIcon={<StarBorderIcon />}
                    variant="outlined"
                    sx={{ color: '#fbbf24', borderColor: 'rgba(251,191,36,0.5)', textTransform: 'none', fontWeight: 600 }}
                  >
                    {settingDefault ? 'Lagrer default…' : 'Sett som default'}
                  </Button>
                </span>
              </Tooltip>
            )}
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Angre (⌘Z)">
              <span>
                <IconButton
                  data-testid="poster-undo"
                  onClick={() => history.undo()}
                  disabled={!history.canUndo}
                  size="small"
                  sx={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  <UndoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Gjør om (⌘⇧Z)">
              <span>
                <IconButton
                  data-testid="poster-redo"
                  onClick={() => history.redo()}
                  disabled={!history.canRedo}
                  size="small"
                  sx={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  <RedoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' },
              gap: 3,
            }}
          >
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
                  TEMA + VARIANT
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 1 }}>
                  {THEME_OPTIONS.map((th) => (
                    <Chip
                      key={th.id}
                      label={th.label}
                      clickable
                      onClick={() => setTheme(th.id)}
                      sx={{
                        bgcolor: theme === th.id ? 'rgba(167,139,250,0.30)' : 'rgba(255,255,255,0.05)',
                        color: theme === th.id ? '#fff' : 'rgba(255,255,255,0.7)',
                        fontWeight: 700,
                        border: theme === th.id ? '1px solid rgba(167,139,250,0.65)' : '1px solid transparent',
                      }}
                    />
                  ))}
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
                  {POSTER_VARIANTS.map((v) => (
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
                  {POSTER_VARIANTS.find((v) => v.id === variant)?.description}
                </Typography>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
                HEADLINE
              </Typography>
              <TextField
                size="small"
                label="Headline (bryt linjer med Enter)"
                value={fields.headline}
                onChange={(e) => setFields({ ...fields, headline: e.target.value })}
                multiline
                minRows={2}
                fullWidth
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
                    subheadingHighlights: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                fullWidth
              />

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
                CONTENT-CARDS (1-4 stk)
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
                label="QR-URL"
                value={fields.qrUrl ?? ''}
                onChange={(e) => setFields({ ...fields, qrUrl: e.target.value })}
                fullWidth
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

            <Stack spacing={1.5} alignItems="center">
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
                LIVE PREVIEW
              </Typography>
              {/* Single-mount renderer: SAMME element brukes for preview OG
                  html2canvas-snapshot. Scale = 1080/380 ved eksport. */}
              <Box sx={{ width: '100%', maxWidth: PREVIEW_WIDTH }}>
                <MarketingFeedPoster
                  fields={fields}
                  variant={variant}
                  theme={theme}
                  ref={previewRef}
                />
              </Box>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                Eksport rendres som {EXPORT_WIDTH}×{Math.round(EXPORT_WIDTH * 1.25)} px ({(EXPORT_WIDTH / PREVIEW_WIDTH).toFixed(2)}×).
              </Typography>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>Lukk</Button>
          <Button
            data-testid="poster-export-svg"
            variant="outlined"
            startIcon={exportingSvg ? <CircularProgress size={16} /> : <ImageIcon />}
            disabled={exportingSvg}
            onClick={() => { void handleExportSvg(); }}
            sx={{ color: '#ddd6fe', borderColor: 'rgba(167,139,250,0.5)', textTransform: 'none', fontWeight: 600 }}
          >
            {exportingSvg ? 'SVG…' : 'Last ned SVG'}
          </Button>
          <Button
            data-testid="poster-export"
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

      {/* "Åpne lagret poster"-picker */}
      <Dialog
        open={openPickerOpen}
        onClose={() => setOpenPickerOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: '#0f0f1a', color: '#fff' }, 'data-testid': 'poster-picker-dialog' } }}
      >
        <DialogTitle data-testid="poster-picker-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Lagrede posters
          <IconButton onClick={() => setOpenPickerOpen(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {savedLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : savedPosters.length === 0 ? (
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', py: 2 }}>
              Ingen lagrede posters ennå. Lagre den åpne posteren først.
            </Typography>
          ) : (
            <List data-testid="poster-saved-list">
              {savedPosters.map((p) => (
                <ListItemButton key={p.id} onClick={() => { void handleOpenSaved(p); }}>
                  <ListItemText
                    primary={p.title}
                    secondary={`${p.templateId} · ${p.theme} · ${new Date(p.updatedAt).toLocaleString('nb-NO')}`}
                    primaryTypographyProps={{ sx: { color: '#fff', fontWeight: 600 } }}
                    secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.5)', fontSize: 12 } }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

interface CardRowProps {
  card: PosterCard;
  onChange: (next: PosterCard) => void;
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
              onChange={(e) => onChange({ ...card, icon: e.target.value as PosterCardIcon })}
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
        <TextField
          size="small"
          label="Bakgrunns-bilde-URL (valgfri)"
          value={card.bgImageUrl ?? ''}
          onChange={(e) => onChange({ ...card, bgImageUrl: e.target.value || undefined })}
          fullWidth
          placeholder="/path/til/bilde.jpg eller full URL"
        />
      </Stack>
    </Box>
  );
}

export default WeeklyBriefEditor;
