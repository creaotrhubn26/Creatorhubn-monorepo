/**
 * DeckEditor — interaktivt redigeringsvindu for et investor-deck.
 *
 * Lastes via /admin-room/deck/:id. Viser de 10 seksjonene som store
 * textfields, auto-save på blur, "Generer via Claude"-knapp per seksjon
 * (bruker eksisterende role-room-investor-deck-claude.ts), og en
 * "Skriv ut / lagre PDF"-knapp som bruker browserens print-CSS.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PrintIcon from '@mui/icons-material/Print';
import { decksApi, type PitchDeck, type PitchDeckSlide } from '../services/adminRoomApi';

const ADMIN_ROOM_OWNER_EMAIL = 'daniel@creatorhubn.com';

const SECTION_LABEL: Record<string, string> = {
  cover: 'Forside',
  problem: 'Problem',
  solution: 'Løsning',
  market: 'Marked',
  business_model: 'Forretningsmodell',
  competition: 'Konkurranse',
  traction: 'Traction',
  team: 'Team',
  funding: 'Finansiering',
  cta: 'Kontakt / CTA',
};

function getCurrentUserEmail(): string {
  try {
    const raw = localStorage.getItem('user') || localStorage.getItem('creatorhub_user');
    if (raw) {
      const parsed = JSON.parse(raw) as { email?: string };
      if (typeof parsed?.email === 'string') return parsed.email.toLowerCase();
    }
  } catch {
    /* ignore */
  }
  return '';
}

function getDeckIdFromPath(): string | null {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const match = path.match(/^\/admin-room\/deck\/([^/?#]+)/);
  return match ? match[1] : null;
}

interface SlideRowProps {
  slide: PitchDeckSlide;
  deckId: string;
  onUpdated: (next: PitchDeckSlide) => void;
}

function SlideRow({ slide, deckId, onUpdated }: SlideRowProps) {
  const [heading, setHeading] = useState(slide.content.heading ?? '');
  const [body, setBody] = useState(slide.content.body ?? '');
  const [notes, setNotes] = useState(slide.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHeading(slide.content.heading ?? '');
    setBody(slide.content.body ?? '');
    setNotes(slide.notes ?? '');
  }, [slide.id, slide.updatedAt]);

  async function persistContent() {
    if (heading === (slide.content.heading ?? '') && body === (slide.content.body ?? '')) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await decksApi.patchSlide(deckId, slide.id, {
        content: { ...slide.content, heading, body },
      });
      onUpdated(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function persistNotes() {
    if (notes === (slide.notes ?? '')) return;
    setSaving(true);
    setError(null);
    try {
      const next = await decksApi.patchSlide(deckId, slide.id, { notes });
      onUpdated(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const result = await decksApi.generateSlide(deckId, slide.id, {});
      onUpdated(result.slide);
      setBody(result.slide.content.body ?? '');
      setHeading(result.slide.content.heading ?? '');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const sectionLabel = SECTION_LABEL[slide.section] ?? slide.section;

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid rgba(148,163,184,0.18)',
        background: 'rgba(15,23,42,0.42)',
        // print-mode tweaks: white background + black text
        '@media print': {
          background: '#fff',
          color: '#0a0a0a',
          border: '1px solid #d1d5db',
          breakInside: 'avoid',
          mb: 2,
        },
      }}
      className="deck-slide"
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            label={`${slide.position + 1}. ${sectionLabel}`}
            sx={{ bgcolor: 'rgba(168,85,247,0.18)', color: '#ddd6fe', fontWeight: 700 }}
          />
          {saving ? <Chip size="small" label="Lagrer…" sx={{ bgcolor: 'rgba(251,191,36,0.16)', color: '#fde68a' }} /> : null}
        </Stack>
        <Button
          size="small"
          variant="outlined"
          startIcon={generating ? <CircularProgress size={14} /> : <AutoAwesomeIcon fontSize="small" />}
          onClick={() => { void handleGenerate(); }}
          disabled={generating}
          sx={{ textTransform: 'none', fontWeight: 700, color: '#a78bfa', borderColor: 'rgba(196,181,253,0.42)' }}
          className="no-print"
        >
          {generating ? 'Genererer…' : 'Generer via Claude'}
        </Button>
      </Stack>
      {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}
      <TextField
        fullWidth
        size="small"
        label="Overskrift"
        value={heading}
        onChange={(e) => setHeading(e.target.value)}
        onBlur={() => { void persistContent(); }}
        sx={{ mb: 1 }}
      />
      <TextField
        fullWidth
        multiline
        minRows={6}
        label="Innhold"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => { void persistContent(); }}
        helperText="Markdown-bullets støttes. Bruker norsk forretnings-stil."
      />
      <TextField
        fullWidth
        multiline
        minRows={2}
        size="small"
        label="Talenotater (vises ikke i deck)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => { void persistNotes(); }}
        sx={{ mt: 1 }}
        className="no-print"
      />
    </Box>
  );
}

export default function DeckEditor() {
  const userEmail = useMemo(() => getCurrentUserEmail(), []);
  const deckId = useMemo(() => getDeckIdFromPath(), []);
  const [deck, setDeck] = useState<PitchDeck | null>(null);
  const [slides, setSlides] = useState<PitchDeckSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;
    setLoading(true);
    decksApi.get(deckId)
      .then(({ deck: d, slides: s }) => {
        if (cancelled) return;
        setDeck(d);
        setSlides(s);
        setTitleDraft(d.title);
        setDescDraft(d.description ?? '');
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [deckId]);

  if (userEmail !== ADMIN_ROOM_OWNER_EMAIL) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error">Admin Room er kun tilgjengelig for produkteier.</Alert>
      </Container>
    );
  }

  if (!deckId) {
    return <Container maxWidth="sm" sx={{ py: 8 }}><Alert severity="error">Ugyldig deck-ID</Alert></Container>;
  }

  if (loading) {
    return <Container maxWidth="md" sx={{ py: 8, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Container>;
  }

  if (error || !deck) {
    return <Container maxWidth="sm" sx={{ py: 8 }}><Alert severity="error">{error ?? 'Deck ikke funnet'}</Alert></Container>;
  }

  async function persistMeta() {
    if (!deck) return;
    if (titleDraft === deck.title && descDraft === (deck.description ?? '')) return;
    setSavingMeta(true);
    try {
      const next = await decksApi.patchMeta(deck.id, {
        title: titleDraft,
        description: descDraft,
      });
      setDeck(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingMeta(false);
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Print CSS: hide chrome + buttons when printing */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .deck-slide { page-break-inside: avoid; }
        }
      `}</style>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1} className="no-print">
          <IconButton onClick={() => { window.location.href = '/admin-room'; }} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.86rem' }}>
            Tilbake til Admin Room
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            startIcon={<PrintIcon />}
            variant="outlined"
            onClick={() => window.print()}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Skriv ut / lagre PDF
          </Button>
        </Stack>
        <Box>
          <TextField
            fullWidth
            label="Deck-tittel"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => { void persistMeta(); }}
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth
            label="Beskrivelse"
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={() => { void persistMeta(); }}
            multiline
            minRows={2}
          />
          {savingMeta ? <Typography sx={{ fontSize: '0.78rem', color: 'rgba(251,191,36,0.7)', mt: 0.4 }}>Lagrer…</Typography> : null}
        </Box>
        <Stack spacing={1.5}>
          {slides
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((slide) => (
              <SlideRow
                key={slide.id}
                slide={slide}
                deckId={deck.id}
                onUpdated={(next) => {
                  setSlides((prev) => prev.map((s) => (s.id === next.id ? next : s)));
                }}
              />
            ))}
        </Stack>
      </Stack>
    </Container>
  );
}
