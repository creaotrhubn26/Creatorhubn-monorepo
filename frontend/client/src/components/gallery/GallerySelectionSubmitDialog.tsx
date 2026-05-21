// @ts-nocheck
/**
 * GallerySelectionSubmitDialog — Slice 9X.82
 *
 * Pic-Time 2.0-inspirert "send mitt utvalg"-dialog. Erstatter
 * standard tabell-style confirmation med editorial/magazine-layout:
 *   - Stort serif-tittel ("Ditt utvalg")
 *   - Curated mosaikk av valgte bilder
 *   - Generøs whitespace + letterboxing
 *   - Smooth fade-in på items
 *   - Pulserende send-knapp etter at klient har bekreftet
 *
 * Bruker eksisterende /api/client/gallery/:accessToken/selections/submit
 * (Slice 9X.82 backend).
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  TextField,
  Fade,
  Grow,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  Favorite as HeartIcon,
  CheckCircleOutline as CheckIcon,
  Send as SendIcon,
} from '@mui/icons-material';

interface FavoriteItem {
  imageId: string;
  thumbnailUrl?: string | null;
  title?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  accessToken: string;
  galleryPassword?: string | null;
  clientEmail: string;
  clientName?: string | null;
  favorites: FavoriteItem[];
  /** Kalt etter vellykket submit slik at caller kan refetche selection-state */
  onSubmitted?: () => void;
}

const SERIF_STACK = '"Cormorant Garamond", "Playfair Display", Georgia, serif';

const GallerySelectionSubmitDialog: React.FC<Props> = ({
  open,
  onClose,
  accessToken,
  galleryPassword,
  clientEmail,
  clientName,
  favorites,
  onSubmitted,
}) => {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const count = favorites.length;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (galleryPassword) headers['x-gallery-password'] = galleryPassword;
      const res = await fetch(`/api/client/gallery/${encodeURIComponent(accessToken)}/selections/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ clientEmail, clientName: clientName || '', note: note.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || data?.error || 'Kunne ikke sende utvalget. Prøv igjen.');
        setIsSubmitting(false);
        return;
      }
      setSubmitted(true);
      setIsSubmitting(false);
      if (onSubmitted) onSubmitted();
      // Auto-close etter 3.5s så klienten får se bekreftelsen
      setTimeout(() => onClose(), 3500);
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke sende utvalget.');
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setNote('');
    setError(null);
    setSubmitted(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          // Pic-Time 2.0: editorial paper med cream-canvas + subtle warmth
          background: 'linear-gradient(180deg, #fdfaf5 0%, #f7f1e8 100%)',
          color: '#1a1612',
          minHeight: '85vh',
          borderRadius: { xs: 0, sm: 3 },
          overflow: 'hidden',
        },
      }}
    >
      {/* Close-knapp øverst i hjørnet, ikke header — magazine-stil */}
      <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }}>
        <IconButton
          onClick={handleClose}
          disabled={isSubmitting}
          aria-label="Lukk"
          sx={{
            color: '#1a1612',
            bgcolor: 'rgba(255,255,255,0.6)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: { xs: 3, sm: 6, md: 8 }, position: 'relative' }}>
        {submitted ? (
          // ── Bekreftelse-state ────────────────────────────────────────
          <Fade in={submitted} timeout={800}>
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Grow in={submitted} timeout={1000}>
                <CheckIcon sx={{ fontSize: 88, color: '#d97706', mb: 3 }} />
              </Grow>
              <Typography
                sx={{
                  fontFamily: SERIF_STACK,
                  fontWeight: 400,
                  fontSize: { xs: '2rem', sm: '3rem' },
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  mb: 2,
                }}
              >
                Tusen takk
              </Typography>
              <Typography
                sx={{
                  fontFamily: SERIF_STACK,
                  fontStyle: 'italic',
                  fontSize: '1.25rem',
                  color: '#5a4f42',
                  maxWidth: 480,
                  mx: 'auto',
                  lineHeight: 1.5,
                }}
              >
                Ditt utvalg er sendt. Fotografen får beskjed og kontakter deg snart.
              </Typography>
            </Box>
          </Fade>
        ) : (
          <>
            {/* ── Header — magazine-style ─────────────────────────────── */}
            <Box sx={{ textAlign: 'center', mb: { xs: 4, sm: 6 } }}>
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.32em',
                  color: '#a8957e',
                  textTransform: 'uppercase',
                  mb: 2,
                }}
              >
                · Ditt utvalg ·
              </Typography>
              <Typography
                component="h1"
                sx={{
                  fontFamily: SERIF_STACK,
                  fontWeight: 400,
                  fontSize: { xs: '2.4rem', sm: '3.6rem', md: '4.2rem' },
                  lineHeight: 1.0,
                  letterSpacing: '-0.02em',
                  color: '#1a1612',
                  mb: 1.5,
                }}
              >
                {count === 1 ? '1 bilde' : `${count} bilder`}
              </Typography>
              <Typography
                sx={{
                  fontFamily: SERIF_STACK,
                  fontStyle: 'italic',
                  fontSize: { xs: '1rem', sm: '1.2rem' },
                  color: '#5a4f42',
                  maxWidth: 460,
                  mx: 'auto',
                  lineHeight: 1.55,
                }}
              >
                {count === 0
                  ? 'Du har ikke valgt noen bilder ennå. Lukk og marker favorittene dine med hjertet.'
                  : 'Dette er utvalget du sender til fotografen. Du kan endre ved å lukke og fjerne hjerter.'}
              </Typography>
            </Box>

            {/* ── Curated mosaikk av bildene ──────────────────────────── */}
            {count > 0 && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, 1fr)',
                    sm: 'repeat(3, 1fr)',
                    md: 'repeat(4, 1fr)',
                    lg: 'repeat(5, 1fr)',
                  },
                  gap: { xs: 1, sm: 1.5, md: 2 },
                  mb: { xs: 4, sm: 6 },
                  maxHeight: { xs: 'auto', md: 480 },
                  overflowY: { xs: 'visible', md: 'auto' },
                  // Smooth scrollbar
                  '&::-webkit-scrollbar': { width: 6 },
                  '&::-webkit-scrollbar-thumb': { background: '#d4c4b0', borderRadius: 3 },
                }}
              >
                {favorites.slice(0, 40).map((item, idx) => (
                  <Fade in timeout={300 + idx * 30} key={item.imageId}>
                    <Box
                      sx={{
                        position: 'relative',
                        aspectRatio: '1 / 1',
                        overflow: 'hidden',
                        borderRadius: 1,
                        boxShadow: '0 2px 12px rgba(26, 22, 18, 0.08)',
                        transition: 'transform 0.4s ease',
                        '&:hover': { transform: 'scale(1.02)' },
                      }}
                    >
                      {item.thumbnailUrl ? (
                        <Box
                          component="img"
                          src={item.thumbnailUrl}
                          alt={item.title || ''}
                          loading="lazy"
                          width={300}
                          height={300}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: '100%',
                            height: '100%',
                            bgcolor: '#e8ddd0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <HeartIcon sx={{ color: '#d97706', fontSize: 32 }} />
                        </Box>
                      )}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          bgcolor: 'rgba(255,255,255,0.95)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                        }}
                      >
                        <HeartIcon sx={{ color: '#d97706', fontSize: 14 }} />
                      </Box>
                    </Box>
                  </Fade>
                ))}
                {count > 40 && (
                  <Box
                    sx={{
                      aspectRatio: '1 / 1',
                      borderRadius: 1,
                      bgcolor: '#e8ddd0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: SERIF_STACK,
                    }}
                  >
                    <Typography sx={{ fontSize: '1.8rem', fontWeight: 400, color: '#1a1612', lineHeight: 1 }}>
                      +{count - 40}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: '#5a4f42', mt: 0.5, letterSpacing: '0.1em' }}>
                      til
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* ── Valgfri melding ─────────────────────────────────────── */}
            {count > 0 && (
              <Box sx={{ maxWidth: 540, mx: 'auto', mb: 3 }}>
                <Typography
                  sx={{
                    fontFamily: SERIF_STACK,
                    fontStyle: 'italic',
                    fontSize: '1rem',
                    color: '#5a4f42',
                    mb: 1.5,
                    textAlign: 'center',
                  }}
                >
                  Vil du legge til en hilsen til fotografen?
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Helt valgfritt — tanker, ønsker, hva som var spesielt..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  inputProps={{ maxLength: 800 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(255,255,255,0.6)',
                      fontFamily: SERIF_STACK,
                      fontStyle: 'italic',
                      fontSize: '1rem',
                      '& fieldset': { borderColor: '#d4c4b0' },
                      '&:hover fieldset': { borderColor: '#a8957e' },
                      '&.Mui-focused fieldset': { borderColor: '#d97706' },
                    },
                  }}
                />
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ maxWidth: 540, mx: 'auto', mb: 2 }}>
                {error}
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      {!submitted && (
        <DialogActions
          sx={{
            px: { xs: 3, sm: 6 },
            pb: { xs: 4, sm: 5 },
            pt: 0,
            justifyContent: 'center',
            gap: 2,
            flexDirection: { xs: 'column-reverse', sm: 'row' },
          }}
        >
          <Button
            onClick={handleClose}
            disabled={isSubmitting}
            sx={{
              fontFamily: SERIF_STACK,
              fontStyle: 'italic',
              color: '#5a4f42',
              textTransform: 'none',
              fontSize: '1rem',
              px: 3,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
            }}
          >
            Lukk og fortsett å velge
          </Button>
          {count > 0 && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || count === 0}
              startIcon={isSubmitting ? <CircularProgress size={18} sx={{ color: '#fdfaf5' }} /> : <SendIcon />}
              sx={{
                bgcolor: '#1a1612',
                color: '#fdfaf5',
                fontFamily: '"Inter", "Segoe UI", sans-serif',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontSize: '0.78rem',
                px: 5,
                py: 1.8,
                borderRadius: 0, // Magazine-stil: hard kant
                minWidth: 220,
                '&:hover': { bgcolor: '#2d2620' },
                '&.Mui-disabled': { bgcolor: '#a8957e', color: '#fdfaf5' },
              }}
            >
              {isSubmitting ? 'Sender…' : 'Send mitt utvalg'}
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default GallerySelectionSubmitDialog;
