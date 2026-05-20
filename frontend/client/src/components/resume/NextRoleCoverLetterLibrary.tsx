/**
 * NextRoleCoverLetterLibrary
 *
 * Dialog som lister alle brukerens AI-genererte søknadsbrev. Brukeren
 * kan kopiere et brev, markere som favoritt, eller slette. Brevene
 * auto-lagres når /ai-cover-letter-endepunktet genererer et nytt.
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Stack, Paper, IconButton, Chip,
  CircularProgress, Alert, Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Article as ArticleIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

function trackGA4(eventName: string, params: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') {
      w.gtag('event', eventName, params);
    }
  } catch {
    /* noop */
  }
}

interface CoverLetter {
  id: string;
  resumeId: string | null;
  jobTitle: string | null;
  company: string | null;
  body: string;
  language: string | null;
  tone: string | null;
  isFavorite: boolean;
  notes: string | null;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export const NextRoleCoverLetterLibrary: React.FC<Props> = ({ open, onClose }) => {
  const { user } = useAuth();
  const [letters, setLetters] = useState<CoverLetter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/api/cover-letters', {
        headers: { 'x-user-id': user?.id || '' },
      });
      setLetters(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Kunne ikke hente søknadsbrev', err);
      setError('Kunne ikke hente søknadsbrev. Prøv igjen om et øyeblikk.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      refresh();
      trackGA4('nextrole_cover_letter_library_opened', { feature: 'cover_letter_library' });
    }
  }, [open]);

  const handleToggleFavorite = async (letter: CoverLetter) => {
    try {
      await apiRequest(`/api/cover-letters/${letter.id}`, {
        method: 'PATCH',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !letter.isFavorite }),
      });
      setLetters((prev) =>
        prev.map((l) => (l.id === letter.id ? { ...l, isFavorite: !l.isFavorite } : l)),
      );
      trackGA4('nextrole_cover_letter_favorite_toggled', {
        letter_id: letter.id,
        is_favorite: !letter.isFavorite,
      });
    } catch (err) {
      console.error('Favoritt-toggle feilet', err);
    }
  };

  const handleCopy = async (letter: CoverLetter) => {
    try {
      await navigator.clipboard.writeText(letter.body);
      setCopiedId(letter.id);
      setTimeout(() => setCopiedId(null), 2000);
      trackGA4('nextrole_cover_letter_copied', {
        letter_id: letter.id,
        body_length: letter.body.length,
        has_job_title: Boolean(letter.jobTitle),
      });
    } catch (err) {
      console.error('Copy feilet', err);
    }
  };

  const handleDelete = async (letter: CoverLetter) => {
    if (!window.confirm('Slette dette søknadsbrevet?')) return;
    try {
      await apiRequest(`/api/cover-letters/${letter.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      });
      setLetters((prev) => prev.filter((l) => l.id !== letter.id));
      trackGA4('nextrole_cover_letter_deleted', { letter_id: letter.id });
    } catch (err) {
      console.error('Sletting feilet', err);
    }
  };

  const filtered = showFavoritesOnly
    ? letters.filter((l) => l.isFavorite)
    : letters;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ArticleIcon sx={{ color: '#F5B82E' }} />
          <Typography variant="h6" component="span">Mine søknadsbrev</Typography>
          {letters.length > 0 && (
            <Chip label={`${letters.length} totalt`} size="small" />
          )}
        </Stack>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!loading && !error && letters.length === 0 && (
          <Alert severity="info">
            Ingen søknadsbrev lagret ennå. Generer ditt første via AI-analyse → "AI-søknadsbrev".
          </Alert>
        )}
        {letters.length > 0 && (
          <>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Chip
                label="Alle"
                size="small"
                onClick={() => setShowFavoritesOnly(false)}
                color={!showFavoritesOnly ? 'primary' : 'default'}
                variant={!showFavoritesOnly ? 'filled' : 'outlined'}
              />
              <Chip
                icon={<StarIcon sx={{ fontSize: 16 }} />}
                label={`Favoritter (${letters.filter((l) => l.isFavorite).length})`}
                size="small"
                onClick={() => setShowFavoritesOnly(true)}
                color={showFavoritesOnly ? 'primary' : 'default'}
                variant={showFavoritesOnly ? 'filled' : 'outlined'}
              />
            </Stack>
            <Stack spacing={1.5}>
              {filtered.map((letter) => {
                const isExpanded = expandedId === letter.id;
                return (
                  <Paper key={letter.id} variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {letter.jobTitle ?? 'Uten tittel'}
                          {letter.company && (
                            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                              {' '}— {letter.company}
                            </Box>
                          )}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.3 }}>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(letter.createdAt).toLocaleDateString('no-NO', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </Typography>
                          {letter.tone && (
                            <Chip label={letter.tone} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                          )}
                          {letter.language && letter.language !== 'no' && (
                            <Chip label={letter.language.toUpperCase()} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                          )}
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small" onClick={() => handleToggleFavorite(letter)} title="Marker som favoritt">
                          {letter.isFavorite ? <StarIcon sx={{ color: '#F5B82E' }} /> : <StarBorderIcon />}
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleCopy(letter)}
                          title="Kopier til utklippstavle"
                          color={copiedId === letter.id ? 'success' : 'default'}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(letter)} color="error" title="Slett">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6,
                        color: 'text.secondary',
                        maxHeight: isExpanded ? 'none' : '4.8em',
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                      onClick={() => setExpandedId(isExpanded ? null : letter.id)}
                    >
                      {letter.body}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => setExpandedId(isExpanded ? null : letter.id)}
                      sx={{ mt: 1, p: 0, textTransform: 'none' }}
                    >
                      {isExpanded ? 'Vis mindre' : 'Vis hele brevet'}
                    </Button>
                    {copiedId === letter.id && (
                      <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                        Kopiert til utklippstavle
                      </Typography>
                    )}
                  </Paper>
                );
              })}
              {filtered.length === 0 && showFavoritesOnly && (
                <Alert severity="info">Ingen favoritt-merkede brev. Stjern et brev for å filtrere det her.</Alert>
              )}
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
};

export default NextRoleCoverLetterLibrary;
