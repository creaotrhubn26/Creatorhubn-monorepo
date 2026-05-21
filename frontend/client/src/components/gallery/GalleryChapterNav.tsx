// @ts-nocheck
/**
 * GalleryChapterNav — Slice 9X.82 (Pic-Time floating chapter-jump)
 *
 * Vertikal navigasjon på siden av galleriet (eller bunn-bar på mobile)
 * med ett trinn per kapittel. Klikk = smooth scroll til chapter-break.
 * Aktive kapittel markeres med fyllet sirkel + serif-tittel.
 *
 * Skjules helt hvis < 2 kapitler.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Stack, Typography, Tooltip, useMediaQuery, useTheme } from '@mui/material';

const SERIF_STACK = '"Cormorant Garamond", "Playfair Display", Georgia, serif';

interface ChapterNavItem {
  id: string;
  title: string;
}

interface Props {
  chapters: ChapterNavItem[];
}

const GalleryChapterNav: React.FC<Props> = ({ chapters }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeId, setActiveId] = useState<string | null>(chapters[0]?.id || null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // IntersectionObserver detekterer hvilket kapittel som er i viewport
  useEffect(() => {
    if (chapters.length < 2) return;
    const elements = chapters
      .map((c) => document.getElementById(`chapter-${c.id}`))
      .filter(Boolean) as HTMLElement[];
    if (elements.length === 0) return;

    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Velg den øverste som er minst 30% synlig
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.3)
          .sort((a, b) => (a.boundingClientRect.top || 0) - (b.boundingClientRect.top || 0));
        if (visible[0]) {
          const id = visible[0].target.id.replace(/^chapter-/, '');
          setActiveId(id);
        }
      },
      { rootMargin: '-20% 0px -50% 0px', threshold: [0, 0.3, 0.6, 1] },
    );
    elements.forEach((el) => observerRef.current!.observe(el));
    return () => {
      observerRef.current?.disconnect();
    };
  }, [chapters]);

  if (chapters.length < 2) return null;

  const handleJump = (id: string) => {
    const el = document.getElementById(`chapter-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  // Mobile: kompakt horisontal bar i bunnen
  if (isMobile) {
    return (
      <Box
        sx={{
          position: 'fixed',
          bottom: 80, // over submit-FAB
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1050,
          bgcolor: 'rgba(10, 8, 7, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(253, 250, 245, 0.18)',
          borderRadius: 999,
          px: 1,
          py: 0.5,
          maxWidth: 'calc(100vw - 32px)',
          overflow: 'auto',
        }}
      >
        <Stack direction="row" spacing={0.5}>
          {chapters.map((ch, idx) => {
            const isActive = ch.id === activeId;
            return (
              <Box
                key={ch.id}
                onClick={() => handleJump(ch.id)}
                role="button"
                tabIndex={0}
                aria-label={`Hopp til kapittel ${ch.title}`}
                aria-current={isActive ? 'true' : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleJump(ch.id);
                  }
                }}
                sx={{
                  cursor: 'pointer',
                  px: 1.5,
                  py: 0.8,
                  borderRadius: 999,
                  bgcolor: isActive ? '#d97706' : 'transparent',
                  color: isActive ? '#fdfaf5' : 'rgba(253, 250, 245, 0.7)',
                  fontFamily: SERIF_STACK,
                  fontSize: '0.85rem',
                  fontStyle: isActive ? 'normal' : 'italic',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  '&:hover': { color: '#fdfaf5' },
                }}
              >
                {String(idx + 1).padStart(2, '0')} · {ch.title}
              </Box>
            );
          })}
        </Stack>
      </Box>
    );
  }

  // Desktop: vertikal pil-list på venstre side
  return (
    <Box
      component="nav"
      aria-label="Kapittel-navigasjon"
      sx={{
        position: 'fixed',
        left: 32,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1050,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        maxHeight: '60vh',
      }}
    >
      {chapters.map((ch, idx) => {
        const isActive = ch.id === activeId;
        return (
          <Tooltip
            key={ch.id}
            title={`${String(idx + 1).padStart(2, '0')} · ${ch.title}`}
            placement="right"
          >
            <Box
              onClick={() => handleJump(ch.id)}
              role="button"
              tabIndex={0}
              aria-label={`Hopp til kapittel ${ch.title}`}
              aria-current={isActive ? 'true' : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleJump(ch.id);
                }
              }}
              sx={{
                cursor: 'pointer',
                py: 1.5,
                px: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                '&:hover .dot': {
                  bgcolor: '#d97706',
                  transform: 'scale(1.3)',
                },
                '&:hover .label': { opacity: 1, transform: 'translateX(0)' },
              }}
            >
              <Box
                className="dot"
                sx={{
                  width: isActive ? 10 : 6,
                  height: isActive ? 10 : 6,
                  borderRadius: '50%',
                  bgcolor: isActive ? '#d97706' : 'rgba(253, 250, 245, 0.42)',
                  transition: 'all 0.3s ease',
                  flexShrink: 0,
                }}
              />
              <Typography
                className="label"
                sx={{
                  fontFamily: SERIF_STACK,
                  fontStyle: isActive ? 'normal' : 'italic',
                  fontSize: '0.95rem',
                  color: isActive ? '#fdfaf5' : 'rgba(253, 250, 245, 0.72)',
                  opacity: isActive ? 1 : 0,
                  transform: isActive ? 'translateX(0)' : 'translateX(-8px)',
                  transition: 'all 0.3s ease',
                  whiteSpace: 'nowrap',
                  fontWeight: isActive ? 500 : 400,
                  letterSpacing: '0.02em',
                }}
              >
                {ch.title}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};

export default GalleryChapterNav;
