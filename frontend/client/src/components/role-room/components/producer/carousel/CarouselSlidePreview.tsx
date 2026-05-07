/**
 * CarouselSlidePreview — renders a single slide as it will appear on
 * a target platform. Uses the slide's brand_overlays + image_ref +
 * text_blocks to produce a faithful WYSIWYG preview.
 *
 * Visual styling matches the "Production Life" reference (dark + accent,
 * brand mark top-left, slide counter top-right, label + headline +
 * sticker overlays).
 */

import { Box, Stack, Typography } from '@mui/material';
import {
  PLATFORM_ASPECTS,
  type CarouselSlideRow,
  type CarouselPlatform,
} from '../../../../../services/carouselService';

interface Props {
  slide: CarouselSlideRow;
  platform: CarouselPlatform;
  /** When true, the preview also renders the slide-counter overlay. */
  totalSlides: number;
  /** Render at this width in px. Height auto-derives from platform aspect. */
  width?: number;
}

const TEXT_STYLE_TO_FONT: Record<string, { size: number; weight: number; transform?: string }> = {
  headline: { size: 36, weight: 700 },
  tagline: { size: 18, weight: 500 },
  caption: { size: 13, weight: 600, transform: 'uppercase' },
  sticker: { size: 16, weight: 600 },
  number: { size: 96, weight: 800 },
  quote: { size: 28, weight: 600 },
};

const POSITION_TO_STYLE: Record<string, React.CSSProperties> = {
  'top-left': { position: 'absolute', top: 24, left: 24, maxWidth: '70%' },
  'top-right': { position: 'absolute', top: 24, right: 24 },
  'bottom-left': { position: 'absolute', bottom: 24, left: 24, maxWidth: '70%' },
  'bottom-right': {
    position: 'absolute',
    bottom: 32,
    right: 24,
    maxWidth: '50%',
    background: 'rgba(255,235,170,0.95)',
    color: '#1f1408',
    padding: '12px 16px',
    borderRadius: 4,
    transform: 'rotate(-2deg)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
  },
  center: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '0 48px',
  },
  'left-half': {
    position: 'absolute',
    top: 24,
    left: 24,
    bottom: 24,
    width: '50%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingRight: 16,
  },
  'right-half': {
    position: 'absolute',
    top: 24,
    right: 24,
    bottom: 24,
    width: '50%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingLeft: 16,
  },
};

function renderImage(slide: CarouselSlideRow): React.ReactNode {
  const ref = slide.image_ref;
  switch (ref.strategy) {
    case 'brand-asset':
    case 'user-gallery':
    case 'stock':
    case 'ai':
      return (
        <Box
          component="img"
          src={'url' in ref ? ref.url : 'generatedUrl' in ref ? ref.generatedUrl : ''}
          alt={'alt' in ref ? ref.alt : ''}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: slide.layout === 'centered-quote' ? 0.4 : 1,
          }}
        />
      );
    case 'color-only':
      return (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(140deg, ${ref.color}, ${shade(ref.color, -0.3)})`,
          }}
        />
      );
  }
}

function shade(hex: string, amount: number): string {
  // Simple hex shade — clamp 0-255
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + Math.round(255 * amount)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + Math.round(255 * amount)));
  const b = Math.min(255, Math.max(0, (num & 0xff) + Math.round(255 * amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export default function CarouselSlidePreview({
  slide,
  platform,
  totalSlides,
  width = 320,
}: Props) {
  const aspect = PLATFORM_ASPECTS[platform];
  const height = (width * aspect.height) / aspect.width;
  const overlay = slide.brand_overlays;
  const counterFormat = `${slide.slide_index + 1}/${totalSlides}`;

  return (
    <Box
      sx={{
        position: 'relative',
        width,
        height,
        bgcolor: '#0a0617',
        borderRadius: 1.5,
        overflow: 'hidden',
        color: '#fff',
        boxShadow: '0 14px 36px rgba(0,0,0,0.45)',
      }}
    >
      {renderImage(slide)}

      {/* Brand mark top-left */}
      {overlay.showLogo && (
        <Stack
          direction="row"
          spacing={0.6}
          alignItems="center"
          sx={{ position: 'absolute', top: 16, left: 16, zIndex: 2 }}
        >
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: '5px',
              background: `linear-gradient(135deg, ${overlay.primaryColor}, ${overlay.accentColor})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {overlay.brandName.charAt(0).toUpperCase()}
          </Box>
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: '#fde68a',
            }}
          >
            {overlay.brandName}
          </Typography>
        </Stack>
      )}

      {/* Slide counter top-right */}
      {overlay.showCounter && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 2,
            border: '1px solid rgba(255,255,255,0.5)',
            borderRadius: 99,
            px: 1.2,
            py: 0.2,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          {counterFormat}
        </Box>
      )}

      {/* Text blocks */}
      {slide.text_blocks.map((block, i) => {
        const styleHint = TEXT_STYLE_TO_FONT[block.style] ?? {
          size: 14,
          weight: 500,
        };
        const positionStyle = POSITION_TO_STYLE[block.position] ?? {};
        const scale = width / 1080; // base design at 1080px wide
        return (
          <Box
            key={`${slide.id}-text-${i}`}
            style={{
              ...positionStyle,
              zIndex: 3,
              fontSize: styleHint.size * scale,
              fontWeight: styleHint.weight,
              textTransform: styleHint.transform as
                | 'uppercase'
                | 'none'
                | 'lowercase'
                | undefined,
              lineHeight: 1.15,
              color:
                block.position === 'bottom-right' && block.style === 'sticker'
                  ? '#1f1408'
                  : block.style === 'caption'
                    ? '#fde68a'
                    : '#ffffff',
            }}
          >
            {block.content || (
              <Box
                component="span"
                sx={{ opacity: 0.45, fontStyle: 'italic' }}
              >
                (legg til {block.style})
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
