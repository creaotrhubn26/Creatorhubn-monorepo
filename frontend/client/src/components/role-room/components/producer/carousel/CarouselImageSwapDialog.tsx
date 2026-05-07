/**
 * CarouselImageSwapDialog — modal for swapping a slide's image source.
 *
 * Three tabs:
 *   1. Galleri — Showcase-gallery matches via Claude Vision tag-overlap
 *   2. AI — generate via Replicate SDXL (cost-aware, brand-tinted)
 *   3. Stock — Unsplash search (deferred to a follow-up; tab present
 *      so the UX doesn't regress later)
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  ImageList,
  ImageListItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CollectionsIcon from '@mui/icons-material/Collections';
import {
  generateAiImageForSlide,
  findGalleryMatchesForSlide,
  type CarouselSlideRow,
  type ImageRef,
  type GalleryAssetMatch,
  type AiImageResult,
} from '../../../../../services/carouselService';

interface Props {
  open: boolean;
  slide: CarouselSlideRow | null;
  onClose: () => void;
  onApply: (slideId: string, imageRef: ImageRef) => void;
  brandColors: { primary: string; secondary: string; accent: string };
}

export default function CarouselImageSwapDialog({
  open,
  slide,
  onClose,
  onApply,
  brandColors,
}: Props) {
  const [tab, setTab] = useState<'gallery' | 'ai' | 'stock'>('gallery');
  const [prompt, setPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiImageResult | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryMatches, setGalleryMatches] = useState<GalleryAssetMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Seed prompt from current ImageRef when modal opens
  useEffect(() => {
    if (!slide) return;
    const ref = slide.image_ref;
    if (ref.strategy === 'ai') setPrompt(ref.prompt);
    else if (ref.strategy === 'stock' || ref.strategy === 'brand-asset' || ref.strategy === 'user-gallery') {
      setPrompt(('alt' in ref && ref.alt) || ('attribution' in ref && ref.attribution) || '');
    }
    setAiResult(null);
    setError(null);
  }, [slide?.id]);

  // Auto-load gallery matches when tab becomes active
  useEffect(() => {
    if (!slide || !open || tab !== 'gallery') return;
    void runGallerySearch(prompt || (slide.text_blocks[0]?.content ?? ''));
  }, [slide?.id, open, tab]);

  async function runGallerySearch(searchPrompt: string) {
    if (!slide) return;
    setGalleryLoading(true);
    setError(null);
    try {
      const { matches } = await findGalleryMatchesForSlide(slide.id, {
        prompt: searchPrompt,
      });
      setGalleryMatches(matches);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGalleryLoading(false);
    }
  }

  async function runAiGeneration() {
    if (!slide || !prompt.trim()) return;
    setAiLoading(true);
    setError(null);
    setAiResult(null);
    try {
      const { result } = await generateAiImageForSlide(slide.id, {
        prompt,
        aspectRatio: '1:1',
        brandColors,
        enrichWithBrand: true,
      });
      setAiResult(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAiLoading(false);
    }
  }

  function applyGallery(match: GalleryAssetMatch) {
    if (!slide) return;
    onApply(slide.id, {
      strategy: 'user-gallery',
      galleryId: match.galleryId,
      assetId: match.assetId,
      url: match.url,
      alt: match.alt ?? '',
    });
  }

  function applyAi() {
    if (!slide || !aiResult) return;
    onApply(slide.id, {
      strategy: 'ai',
      prompt: aiResult.prompt,
      generatedUrl: aiResult.generatedUrl,
      cost: aiResult.cost,
      model: aiResult.model,
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { bgcolor: 'rgba(15,23,42,0.96)', color: '#e2e8f0' },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Bytt bilde for slide {slide ? slide.slide_index + 1 : ''}
        <IconButton onClick={onClose} sx={{ color: 'rgba(226,232,240,0.65)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v as 'gallery' | 'ai' | 'stock')}
          sx={{
            borderBottom: '1px solid rgba(168,85,247,0.22)',
            '& .MuiTab-root': {
              color: 'rgba(226,232,240,0.65)',
              textTransform: 'none',
            },
            '& .Mui-selected': { color: '#22d3ee !important' },
            '& .MuiTabs-indicator': { bgcolor: '#22d3ee' },
          }}
        >
          <Tab value="gallery" icon={<CollectionsIcon fontSize="small" />} iconPosition="start" label="Mine galleri" />
          <Tab value="ai" icon={<AutoAwesomeIcon fontSize="small" />} iconPosition="start" label="AI-generer" />
          <Tab value="stock" disabled label="Stock (kommer)" />
        </Tabs>

        <Box sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* GALLERY */}
          {tab === 'gallery' && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Søk i dine galleri…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#e2e8f0',
                      '& fieldset': { borderColor: 'rgba(168,85,247,0.22)' },
                    },
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={() => runGallerySearch(prompt)}
                  disabled={galleryLoading}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                >
                  Søk
                </Button>
              </Stack>
              {galleryLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress sx={{ color: '#c084fc' }} />
                </Box>
              ) : galleryMatches.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.65)' }}>
                  Ingen treff. Prøv et annet søk eller bruk AI-fanen.
                </Typography>
              ) : (
                <ImageList cols={3} gap={8}>
                  {galleryMatches.map((m) => (
                    <ImageListItem
                      key={m.assetId}
                      onClick={() => applyGallery(m)}
                      sx={{
                        cursor: 'pointer',
                        position: 'relative',
                        borderRadius: 1,
                        overflow: 'hidden',
                        '&:hover img': { transform: 'scale(1.04)' },
                      }}
                    >
                      <img
                        src={m.thumbnailUrl ?? m.url}
                        alt={m.alt ?? ''}
                        style={{ transition: 'transform 120ms ease', objectFit: 'cover' }}
                      />
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ position: 'absolute', top: 6, left: 6 }}
                      >
                        {m.matchedOn.map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(168,85,247,0.7)',
                              color: '#fff',
                              fontSize: 10,
                              height: 18,
                            }}
                          />
                        ))}
                      </Stack>
                    </ImageListItem>
                  ))}
                </ImageList>
              )}
            </Stack>
          )}

          {/* AI */}
          {tab === 'ai' && (
            <Stack spacing={2}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Bildeprompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#e2e8f0',
                    '& fieldset': { borderColor: 'rgba(168,85,247,0.22)' },
                  },
                }}
              />
              <Stack direction="row" alignItems="center" spacing={2}>
                <Button
                  variant="contained"
                  onClick={runAiGeneration}
                  disabled={aiLoading || !prompt.trim()}
                  startIcon={aiLoading ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
                  sx={{
                    bgcolor: '#a855f7',
                    '&:hover': { bgcolor: '#9333ea' },
                    textTransform: 'none',
                  }}
                >
                  {aiLoading ? 'Genererer (~20s)…' : 'Generer bilde'}
                </Button>
                <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.65)' }}>
                  ~3 NOK per bilde · cache 30 dager
                </Typography>
              </Stack>
              {aiResult && (
                <Stack spacing={1.4}>
                  <Box
                    component="img"
                    src={aiResult.generatedUrl}
                    alt={aiResult.prompt}
                    sx={{
                      width: '100%',
                      maxWidth: 480,
                      borderRadius: 1.5,
                      border: '1px solid rgba(168,85,247,0.22)',
                    }}
                  />
                  <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.65)' }}>
                    {aiResult.cached ? 'Cached (gratis)' : `Generert · model: ${aiResult.model}`}
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={applyAi}
                    sx={{
                      bgcolor: '#34d399',
                      color: '#0a0617',
                      fontWeight: 700,
                      '&:hover': { bgcolor: '#10b981' },
                      textTransform: 'none',
                      alignSelf: 'flex-start',
                    }}
                  >
                    Bruk dette bildet
                  </Button>
                </Stack>
              )}
            </Stack>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
