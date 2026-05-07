/**
 * CarouselPostEditor — single-post editor view.
 *
 * Top: slide-strip (drag to reorder, click to select)
 * Center: live preview using CarouselSlidePreview
 * Right: inspector with text-block editing + platform-aware caption
 *        editing. Platform-tabs swap the caption + aspect-ratio preview.
 */

import { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageIcon from '@mui/icons-material/Image';
import CarouselSlidePreview from './CarouselSlidePreview';
import CarouselImageSwapDialog from './CarouselImageSwapDialog';
import {
  PLATFORM_LABELS,
  PLATFORM_ASPECTS,
  PLATFORM_CAPTION_LIMIT,
  type CarouselPostRow,
  type CarouselSlideRow,
  type CarouselPlatform,
  type ImageRef,
} from '../../../../../services/carouselService';

const PLATFORMS: CarouselPlatform[] = [
  'instagram',
  'facebook',
  'linkedin',
  'pinterest',
  'youtube',
];

interface Props {
  post: CarouselPostRow;
  slides: CarouselSlideRow[];
  onBack: () => void;
  onSlidePatch: (slideId: string, patch: Partial<CarouselSlideRow>) => void;
  onCaptionPatch: (postId: string, platform: CarouselPlatform, value: string) => void;
  onApprovePublish?: (postId: string) => Promise<void> | void;
  onSchedulePatch?: (postId: string, scheduledAt: string | null) => void;
  approveBusy?: boolean;
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CarouselPostEditor({
  post,
  slides,
  onBack,
  onSlidePatch,
  onCaptionPatch,
  onApprovePublish,
  onSchedulePatch,
  approveBusy,
}: Props) {
  const scheduledFuture = !!post.scheduled_at && new Date(post.scheduled_at).getTime() > Date.now();
  const [selectedPlatform, setSelectedPlatform] = useState<CarouselPlatform>(
    post.primary_platform,
  );
  const [selectedSlideIdx, setSelectedSlideIdx] = useState(0);
  const [imageSwapOpen, setImageSwapOpen] = useState(false);

  const sortedSlides = useMemo(
    () => [...slides].sort((a, b) => a.slide_index - b.slide_index),
    [slides],
  );
  const selectedSlide = sortedSlides[selectedSlideIdx] ?? sortedSlides[0];

  const aspect = PLATFORM_ASPECTS[selectedPlatform];
  const previewWidth = aspect.width >= aspect.height ? 480 : 380;

  function handleTextBlockChange(blockIdx: number, newContent: string) {
    if (!selectedSlide) return;
    const newBlocks = selectedSlide.text_blocks.map((b, i) =>
      i === blockIdx ? { ...b, content: newContent } : b,
    );
    onSlidePatch(selectedSlide.id, { text_blocks: newBlocks });
  }

  const caption = post.caption?.[selectedPlatform] ?? '';
  const captionLimit = PLATFORM_CAPTION_LIMIT[selectedPlatform];
  const captionOverLimit = caption.length > captionLimit;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <IconButton onClick={onBack} sx={{ color: '#c084fc' }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.65)' }}>
            {post.format} · dag {post.day_of_week} · status: {post.status}
          </Typography>
          <Typography variant="h6" sx={{ color: '#e2e8f0', fontWeight: 700 }}>
            {post.hook}
          </Typography>
        </Box>
        {onApprovePublish && post.status === 'draft' && (
          <Stack direction="row" alignItems="center" spacing={1}>
            {onSchedulePatch && (
              <TextField
                type="datetime-local"
                size="small"
                label="Planlegg (valgfritt)"
                value={toLocalInputValue(post.scheduled_at)}
                onChange={(e) => {
                  const v = e.target.value;
                  onSchedulePatch(post.id, v ? new Date(v).toISOString() : null);
                }}
                InputLabelProps={{ shrink: true, sx: { color: 'rgba(226,232,240,0.65)' } }}
                sx={{
                  width: 200,
                  '& .MuiOutlinedInput-root': {
                    color: '#e2e8f0',
                    '& fieldset': { borderColor: 'rgba(168,85,247,0.35)' },
                  },
                }}
              />
            )}
            <Button
              variant="contained"
              onClick={() => onApprovePublish(post.id)}
              disabled={approveBusy}
              sx={{
                bgcolor: '#34d399',
                color: '#0a0617',
                fontWeight: 700,
                '&:hover': { bgcolor: '#10b981' },
                textTransform: 'none',
              }}
            >
              {approveBusy
                ? 'Publiserer…'
                : scheduledFuture
                  ? 'Godkjenn + planlegg'
                  : 'Godkjenn + send nå'}
            </Button>
          </Stack>
        )}
      </Stack>

      {/* Slide-strip */}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          overflowX: 'auto',
          py: 1,
          mb: 2,
          '&::-webkit-scrollbar': { height: 6 },
        }}
      >
        {sortedSlides.map((s, i) => (
          <Box
            key={s.id}
            onClick={() => setSelectedSlideIdx(i)}
            sx={{
              cursor: 'pointer',
              opacity: i === selectedSlideIdx ? 1 : 0.55,
              transition: 'opacity 100ms ease',
              outline: i === selectedSlideIdx ? '2px solid #a855f7' : 'none',
              outlineOffset: 2,
              borderRadius: 1.5,
            }}
          >
            <CarouselSlidePreview
              slide={s}
              platform={selectedPlatform}
              totalSlides={sortedSlides.length}
              width={130}
            />
          </Box>
        ))}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        {/* Live preview */}
        <Card
          variant="outlined"
          sx={{ p: 2, bgcolor: 'rgba(15,23,42,0.6)', borderColor: 'rgba(168,85,247,0.22)' }}
        >
          <Tabs
            value={selectedPlatform}
            onChange={(_, v) => setSelectedPlatform(v as CarouselPlatform)}
            variant="scrollable"
            sx={{
              mb: 2,
              minHeight: 36,
              '& .MuiTab-root': {
                minHeight: 36,
                color: 'rgba(226,232,240,0.65)',
                textTransform: 'none',
                fontSize: 13,
              },
              '& .Mui-selected': { color: '#22d3ee !important' },
              '& .MuiTabs-indicator': { bgcolor: '#22d3ee' },
            }}
          >
            {PLATFORMS.map((p) => (
              <Tab
                key={p}
                value={p}
                label={`${PLATFORM_LABELS[p]} · ${PLATFORM_ASPECTS[p].label}`}
              />
            ))}
          </Tabs>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            {selectedSlide && (
              <CarouselSlidePreview
                slide={selectedSlide}
                platform={selectedPlatform}
                totalSlides={sortedSlides.length}
                width={previewWidth}
              />
            )}
          </Box>
        </Card>

        {/* Inspector */}
        <Stack spacing={2}>
          <Card
            variant="outlined"
            sx={{ p: 2, bgcolor: 'rgba(15,23,42,0.6)', borderColor: 'rgba(168,85,247,0.22)' }}
          >
            <Typography variant="overline" sx={{ color: '#c084fc' }}>
              Slide {selectedSlideIdx + 1} av {sortedSlides.length} · {selectedSlide?.layout}
            </Typography>
            <Stack spacing={1.4} sx={{ mt: 1 }}>
              {selectedSlide?.text_blocks.map((block, i) => (
                <TextField
                  key={`${selectedSlide.id}-block-${i}`}
                  fullWidth
                  size="small"
                  multiline={block.style === 'quote' || block.style === 'sticker'}
                  minRows={block.style === 'quote' || block.style === 'sticker' ? 2 : 1}
                  label={`${block.style.toUpperCase()} · ${block.position}`}
                  value={block.content}
                  onChange={(e) => handleTextBlockChange(i, e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#e2e8f0',
                      '& fieldset': { borderColor: 'rgba(168,85,247,0.22)' },
                    },
                  }}
                />
              ))}
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={`Bilde: ${selectedSlide?.image_ref.strategy ?? '—'}`}
                  sx={{ bgcolor: 'rgba(34,211,238,0.12)', color: '#22d3ee' }}
                />
                <Chip
                  size="small"
                  label={`Layout: ${selectedSlide?.layout}`}
                  sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#c084fc' }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setImageSwapOpen(true)}
                  startIcon={<ImageIcon fontSize="small" />}
                  sx={{
                    color: '#c084fc',
                    borderColor: 'rgba(168,85,247,0.45)',
                    textTransform: 'none',
                    ml: 'auto',
                  }}
                >
                  Bytt bilde
                </Button>
              </Stack>
            </Stack>
          </Card>

          <Card
            variant="outlined"
            sx={{ p: 2, bgcolor: 'rgba(15,23,42,0.6)', borderColor: 'rgba(168,85,247,0.22)' }}
          >
            <Typography variant="overline" sx={{ color: '#c084fc' }}>
              {PLATFORM_LABELS[selectedPlatform]} caption
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={6}
              value={caption}
              onChange={(e) => onCaptionPatch(post.id, selectedPlatform, e.target.value)}
              sx={{
                mt: 1,
                '& .MuiOutlinedInput-root': {
                  color: '#e2e8f0',
                  fontSize: 13,
                  '& fieldset': {
                    borderColor: captionOverLimit
                      ? '#f87171'
                      : 'rgba(168,85,247,0.22)',
                  },
                },
              }}
            />
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
              <Typography
                variant="caption"
                sx={{ color: captionOverLimit ? '#f87171' : 'rgba(226,232,240,0.65)' }}
              >
                {caption.length} / {captionLimit} tegn
              </Typography>
              <Button
                size="small"
                variant="text"
                disabled={!captionOverLimit}
                onClick={() =>
                  onCaptionPatch(post.id, selectedPlatform, caption.slice(0, captionLimit))
                }
                sx={{ color: '#c084fc', textTransform: 'none' }}
              >
                Klipp til grense
              </Button>
            </Stack>
          </Card>
        </Stack>
      </Box>

      <CarouselImageSwapDialog
        open={imageSwapOpen}
        slide={selectedSlide ?? null}
        onClose={() => setImageSwapOpen(false)}
        onApply={(slideId, imageRef: ImageRef) => {
          onSlidePatch(slideId, { image_ref: imageRef });
          setImageSwapOpen(false);
        }}
        brandColors={{
          primary: selectedSlide?.brand_overlays.primaryColor ?? '#0a0617',
          secondary: '#1a1133',
          accent: selectedSlide?.brand_overlays.accentColor ?? '#a855f7',
        }}
      />
    </Box>
  );
}
