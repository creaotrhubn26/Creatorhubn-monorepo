// @ts-nocheck
/**
 * GalleryChapterBreak — Slice 9X.82 (Pic-Time chapter-rendering)
 *
 * Magazine-style chapter-divider mellom bilde-grupper i klient-galleri.
 * Erstatter flat grid med editorial "Forberedelse → Vielsen → Festen"-
 * narrativ. Følger Pic-Time 2.0 aesthetic-blueprint:
 *   - Cormorant serif på chapter-tittel (4-5rem)
 *   - Italic intro-tekst
 *   - Generøs whitespace (90vh top-padding)
 *   - Liten ornament-strek over tittelen
 *   - Volumnummer i hjørnet ("Chapter 02 / 04")
 */

import React from 'react';
import { Box, Typography } from '@mui/material';

const SERIF_STACK = '"Cormorant Garamond", "Playfair Display", Georgia, serif';

export interface GalleryChapter {
  id: string;
  title: string;
  intro?: string | null;
  /** Hvilke bilde-IDer som hører hjemme i dette kapitlet */
  imageIds?: string[];
  /** Valgfri tekst-overskrift over tittel (f.eks. "I") */
  romanNumeral?: string | null;
  /** Slice 9X.82 (Bjarne) — videoUrl rendres som CinematicVideoPlayer
   *  inni chapter-seksjonen, brukes for video-leveranser. */
  videoUrl?: string | null;
  videoPoster?: string | null;
  /** Underkapittel-markører på video-progress-bar */
  videoMarkers?: Array<{ startSec: number; title: string; romanNumeral?: string | null; intro?: string | null }>;
  /** Slice 9X.82 (Michael) — audioUrl rendres som CinematicAudioPlayer.
   *  Brukes for musikkprodusent-leveranser (mix/master/stems). */
  audioUrl?: string | null;
  /** Album-cover for audio-track */
  audioCover?: string | null;
  /** Credits-tekst ("Komponist X · Vokal Y · Mix Z") */
  audioCredits?: string | null;
  /** Section-markører for audio (Intro/Vers/Refreng/Bro/Outro) */
  audioSections?: Array<{ startSec: number; title: string; romanNumeral?: string | null }>;
}

interface Props {
  chapter: GalleryChapter;
  index: number;
  totalChapters: number;
}

const ROMAN: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
  9: 'IX',
  10: 'X',
};

const GalleryChapterBreak: React.FC<Props> = ({ chapter, index, totalChapters }) => {
  const numeral = chapter.romanNumeral || ROMAN[index + 1] || String(index + 1);
  const isFirst = index === 0;

  return (
    <Box
      component="section"
      id={`chapter-${chapter.id}`}
      aria-labelledby={`chapter-${chapter.id}-title`}
      sx={{
        scrollMarginTop: { xs: 80, md: 120 }, // Header-clearance ved deep-link/scroll
        // Pic-Time letterboxing: store top/bottom-padding for å gi pause
        pt: { xs: 8, sm: 12, md: isFirst ? 8 : 20 },
        pb: { xs: 6, sm: 8, md: 10 },
        px: { xs: 3, md: 4 },
        textAlign: 'center',
        position: 'relative',
        gridColumn: '1 / -1', // strekker over hele grid-bredden hvis i grid
      }}
    >
      {/* Volum/Chapter-meta (subtilt, magazine-stil) */}
      <Typography
        sx={{
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.4em',
          color: 'rgba(255, 245, 232, 0.5)',
          textTransform: 'uppercase',
          mb: 4,
        }}
      >
        Kapittel {String(index + 1).padStart(2, '0')} / {String(totalChapters).padStart(2, '0')}
      </Typography>

      {/* Ornament-strek */}
      <Box
        sx={{
          width: 56,
          height: 1,
          bgcolor: 'rgba(217, 119, 6, 0.6)',
          mx: 'auto',
          mb: 2,
        }}
      />

      {/* Romersk numeral som decorative overskrift */}
      <Typography
        sx={{
          fontFamily: SERIF_STACK,
          fontStyle: 'italic',
          fontSize: '1.1rem',
          color: '#d97706',
          letterSpacing: '0.18em',
          mb: 2,
        }}
      >
        {numeral}
      </Typography>

      {/* Hovedtittel */}
      <Typography
        component="h2"
        id={`chapter-${chapter.id}-title`}
        sx={{
          fontFamily: SERIF_STACK,
          fontWeight: 400,
          fontSize: { xs: '2.5rem', sm: '3.6rem', md: '4.8rem' },
          lineHeight: 1.0,
          letterSpacing: '-0.025em',
          color: '#fff5e8',
          mb: chapter.intro ? 3 : 0,
          maxWidth: 720,
          mx: 'auto',
        }}
      >
        {chapter.title}
      </Typography>

      {/* Italic intro-tekst */}
      {chapter.intro && (
        <Typography
          sx={{
            fontFamily: SERIF_STACK,
            fontStyle: 'italic',
            fontSize: { xs: '1.05rem', sm: '1.2rem' },
            lineHeight: 1.65,
            color: 'rgba(255, 245, 232, 0.78)',
            maxWidth: 520,
            mx: 'auto',
          }}
        >
          {chapter.intro}
        </Typography>
      )}

      {/* Ornament-strek under (mirror) */}
      <Box
        sx={{
          width: 56,
          height: 1,
          bgcolor: 'rgba(217, 119, 6, 0.6)',
          mx: 'auto',
          mt: 5,
        }}
      />
    </Box>
  );
};

export default GalleryChapterBreak;
