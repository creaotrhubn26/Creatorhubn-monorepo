/**
 * BlockRenderer.tsx
 *
 * Frontend-renderer for block-CMS med polert design (Fase 8).
 *
 * Designprinsipper:
 *   - Framer Motion scroll-reveal (én gang per blokk, viewport-trigget)
 *   - Bedre typografi: tighter letter-spacing på headlines, romslig line-height
 *   - Mobile-first responsive padding/font-sizes
 *   - Hover-microinteractions på interaktive elementer
 *   - Accordion-FAQ med smooth height-transitioner
 *   - Gradient-CTA med shadow-lift
 *   - Comparison med alternerende row-bg
 *   - Stagger-animasjon på feature-lister
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Container,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DOMPurify from 'dompurify';
import { motion } from 'framer-motion';
import { applyLocale, DEFAULT_LOCALE, type Locale } from './blockSchema';
import type {
  Block,
  ComparisonBlock,
  ComparisonSupport,
  CtaBlock,
  FaqBlock,
  FeatureListBlock,
  HeroBlock,
  ImageBlock,
  RelatedStudiesBlock,
  RichTextBlock,
  UsageExamplesBlock,
} from './blockSchema';

interface BlockRendererProps {
  blocks: Block[];
  locale?: Locale;
}

// Felles motion-konfig for scroll-reveal-animasjoner. Trigget kun
// første gang blokken kommer i viewport (once: true).
const REVEAL_VARIANTS = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 0.61, 0.36, 1] as [number, number, number, number] },
  },
};

const STAGGER_CHILD_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function RevealBlock({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={REVEAL_VARIANTS}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

export default function BlockRenderer({ blocks, locale = DEFAULT_LOCALE }: BlockRendererProps) {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 5, md: 10 } }}>
      <Stack spacing={{ xs: 5, md: 8 }}>
        {blocks.map((block, idx) => (
          <RevealBlock key={block.id} delay={idx === 0 ? 0 : 0.05}>
            <BlockView block={applyLocale(block, locale)} />
          </RevealBlock>
        ))}
      </Stack>
    </Container>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'hero':
      return <HeroView block={block} />;
    case 'richText':
      return <RichTextView block={block} />;
    case 'faq':
      return <FaqView block={block} />;
    case 'comparison':
      return <ComparisonView block={block} />;
    case 'cta':
      return <CtaView block={block} />;
    case 'featureList':
      return <FeatureListView block={block} />;
    case 'relatedStudies':
      return <RelatedStudiesView block={block} />;
    case 'usageExamples':
      return <UsageExamplesView block={block} />;
    case 'image':
      return <ImageView block={block} />;
  }
}

function HeroView({ block }: { block: HeroBlock }) {
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 860 }}>
      {block.audienceChip ? (
        <Chip
          label={block.audienceChip}
          size="small"
          sx={{
            alignSelf: 'flex-start',
            background: 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(96,165,250,0.18))',
            color: '#ddd6fe',
            fontWeight: 700,
            letterSpacing: 0.3,
            border: '1px solid rgba(167,139,250,0.32)',
            backdropFilter: 'blur(8px)',
            px: 1.2,
            py: 0.4,
          }}
        />
      ) : null}
      <Typography
        component="h1"
        sx={{
          color: '#f8fafc',
          fontWeight: 800,
          fontSize: { xs: '2rem', sm: '2.5rem', md: '3.25rem' },
          lineHeight: { xs: 1.15, md: 1.1 },
          letterSpacing: '-0.02em',
        }}
      >
        {block.h1}
      </Typography>
      {block.subtitle ? (
        <Typography
          sx={{
            color: 'rgba(203,213,225,0.92)',
            fontSize: { xs: '1.05rem', md: '1.25rem' },
            lineHeight: 1.55,
            fontWeight: 400,
          }}
        >
          {block.subtitle}
        </Typography>
      ) : null}
      {block.intro ? (
        <Typography
          sx={{
            color: 'rgba(203,213,225,0.78)',
            fontSize: { xs: '0.98rem', md: '1.05rem' },
            lineHeight: 1.75,
          }}
        >
          {block.intro}
        </Typography>
      ) : null}
      {(block.primaryCtaLabel || block.secondaryCtaLabel) ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1.5 }}>
          {block.primaryCtaLabel ? (
            <Button
              href={block.primaryCtaUrl || '/'}
              variant="contained"
              size="large"
              sx={{
                background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
                color: '#0b1120',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '1rem',
                px: 3.5,
                py: 1.4,
                borderRadius: 1.5,
                boxShadow: '0 8px 24px rgba(167,139,250,0.32)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 32px rgba(167,139,250,0.5)',
                  background: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)',
                },
              }}
            >
              {block.primaryCtaLabel}
            </Button>
          ) : null}
          {block.secondaryCtaLabel ? (
            <Button
              href={block.secondaryCtaUrl || '/'}
              variant="outlined"
              size="large"
              sx={{
                color: 'rgba(203,213,225,0.95)',
                borderColor: 'rgba(148,163,184,0.4)',
                borderWidth: 1.5,
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                py: 1.4,
                borderRadius: 1.5,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'rgba(203,213,225,0.7)',
                  bgcolor: 'rgba(148,163,184,0.08)',
                  borderWidth: 1.5,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              {block.secondaryCtaLabel}
            </Button>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}

const PURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 's', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'hr', 'code', 'blockquote'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
};

function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return '';
  return DOMPurify.sanitize(html, PURIFY_CONFIG) as string;
}

function RichTextView({ block }: { block: RichTextBlock }) {
  const stripped = block.text?.replace(/<[^>]+>/g, '').trim() ?? '';
  if (!stripped && !block.heading) return null;
  return (
    <Stack spacing={2}>
      {block.heading ? (
        <Typography
          component="h2"
          sx={{
            color: '#f8fafc',
            fontWeight: 700,
            fontSize: { xs: '1.5rem', md: '2rem' },
            letterSpacing: '-0.015em',
            lineHeight: 1.2,
          }}
        >
          {block.heading}
        </Typography>
      ) : null}
      {block.text ? (
        <Box
          sx={{
            color: 'rgba(203,213,225,0.92)',
            fontSize: { xs: '1rem', md: '1.05rem' },
            lineHeight: 1.75,
            '& p': { my: 1.5 },
            '& h1, & h2, & h3, & h4': {
              color: '#f8fafc',
              fontWeight: 700,
              mt: 3,
              mb: 1.2,
              letterSpacing: '-0.015em',
            },
            '& h2': { fontSize: { xs: '1.3rem', md: '1.6rem' } },
            '& h3': { fontSize: { xs: '1.1rem', md: '1.25rem' } },
            '& ul, & ol': { pl: 3.5, my: 1.5 },
            '& li': { mb: 0.6, lineHeight: 1.7 },
            '& a': {
              color: '#a78bfa',
              textDecoration: 'underline',
              textDecorationColor: 'rgba(167,139,250,0.4)',
              transition: 'all 0.15s ease',
              '&:hover': { textDecorationColor: '#a78bfa' },
            },
            '& strong': { color: '#f8fafc', fontWeight: 700 },
            '& hr': { my: 3, borderColor: 'rgba(255,255,255,0.12)' },
            '& code': {
              bgcolor: 'rgba(255,255,255,0.08)',
              px: 0.8,
              py: 0.3,
              borderRadius: 0.6,
              fontSize: '0.92em',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            },
            '& blockquote': {
              borderLeft: '3px solid #a78bfa',
              pl: 2,
              my: 2,
              color: 'rgba(203,213,225,0.96)',
              fontStyle: 'italic',
            },
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.text) }}
        />
      ) : null}
    </Stack>
  );
}

function FaqView({ block }: { block: FaqBlock }) {
  const items = (block.items ?? []).filter((it) => it.q || it.a);
  if (!items.length) return null;
  return (
    <Stack spacing={3}>
      <Typography
        component="h2"
        sx={{
          color: '#f8fafc',
          fontWeight: 700,
          fontSize: { xs: '1.5rem', md: '2rem' },
          letterSpacing: '-0.015em',
        }}
      >
        {block.heading || 'Spørsmål og svar'}
      </Typography>
      <Stack spacing={1.2}>
        {items.map((item, i) => (
          <FaqAccordionItem key={i} q={item.q} a={item.a} />
        ))}
      </Stack>
    </Stack>
  );
}

function FaqAccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Card
      sx={{
        bgcolor: open ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.03)',
        border: open ? '1px solid rgba(167,139,250,0.32)' : '1px solid rgba(255,255,255,0.08)',
        transition: 'all 0.2s ease',
        '&:hover': {
          bgcolor: 'rgba(167,139,250,0.05)',
          border: '1px solid rgba(167,139,250,0.24)',
        },
      }}
    >
      <Box
        onClick={() => setOpen((v) => !v)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 1.8,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: { xs: '1rem', md: '1.05rem' }, flex: 1 }}>
          {q}
        </Typography>
        <ExpandMoreIcon
          sx={{
            color: open ? '#a78bfa' : 'rgba(203,213,225,0.6)',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.25s ease, color 0.2s ease',
          }}
        />
      </Box>
      <Collapse in={open} timeout={250}>
        <Box sx={{ px: 2.5, pb: 2.4, pt: 0 }}>
          <Typography sx={{ color: 'rgba(203,213,225,0.86)', fontSize: '0.98rem', lineHeight: 1.7 }}>
            {a}
          </Typography>
        </Box>
      </Collapse>
    </Card>
  );
}

function ComparisonView({ block }: { block: ComparisonBlock }) {
  const rows = (block.rows ?? []).filter((r) => r.feature);
  if (!rows.length) return null;
  return (
    <Stack spacing={3}>
      {block.heading ? (
        <Typography
          component="h2"
          sx={{
            color: '#f8fafc',
            fontWeight: 700,
            fontSize: { xs: '1.5rem', md: '2rem' },
            letterSpacing: '-0.015em',
          }}
        >
          {block.heading}
        </Typography>
      ) : null}
      <TableContainer
        sx={{
          bgcolor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <Table>
          <TableHead>
            <TableRow
              sx={{
                background: 'linear-gradient(180deg, rgba(167,139,250,0.08), rgba(167,139,250,0.02))',
              }}
            >
              <TableCell
                sx={{
                  color: 'rgba(203,213,225,0.85)',
                  borderColor: 'rgba(255,255,255,0.08)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  py: 2,
                }}
              >
                Funksjon
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  color: '#ddd6fe',
                  fontWeight: 800,
                  borderColor: 'rgba(255,255,255,0.08)',
                  fontSize: '0.95rem',
                  py: 2,
                }}
              >
                The Role Room
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  color: 'rgba(203,213,225,0.75)',
                  borderColor: 'rgba(255,255,255,0.08)',
                  fontWeight: 600,
                  py: 2,
                }}
              >
                {block.competitorLabel}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow
                key={i}
                sx={{
                  bgcolor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  '&:hover': { bgcolor: 'rgba(167,139,250,0.04)' },
                  transition: 'background 0.15s ease',
                }}
              >
                <TableCell
                  sx={{
                    color: 'rgba(241,245,249,0.95)',
                    borderColor: 'rgba(255,255,255,0.05)',
                    py: 1.8,
                    fontSize: '0.95rem',
                  }}
                >
                  {row.feature}
                </TableCell>
                <TableCell align="center" sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <SupportIcon value={row.roleRoom} />
                </TableCell>
                <TableCell align="center" sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <SupportIcon value={row.competitor} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function SupportIcon({ value }: { value: ComparisonSupport }) {
  switch (value) {
    case 'yes':
      return <CheckCircleIcon sx={{ color: '#86efac', filter: 'drop-shadow(0 0 6px rgba(134,239,172,0.3))' }} />;
    case 'no':
      return <RemoveCircleOutlineIcon sx={{ color: 'rgba(203,213,225,0.35)' }} />;
    case 'partial':
      return <HelpOutlineIcon sx={{ color: '#fdba74' }} />;
    case 'unknown':
    default:
      return <HelpOutlineIcon sx={{ color: 'rgba(203,213,225,0.3)' }} />;
  }
}

function CtaView({ block }: { block: CtaBlock }) {
  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(167,139,250,0.14) 0%, rgba(96,165,250,0.12) 100%)',
        border: '1px solid rgba(167,139,250,0.32)',
        borderRadius: 2.5,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: -50,
          right: -50,
          width: 200,
          height: 200,
          background: 'radial-gradient(circle, rgba(167,139,250,0.2), transparent 70%)',
          pointerEvents: 'none',
        },
      }}
    >
      <CardContent sx={{ py: { xs: 4, md: 5 }, px: { xs: 3, md: 5 }, position: 'relative' }}>
        <Stack spacing={2.5} sx={{ maxWidth: 720 }}>
          <Typography
            component="h2"
            sx={{
              color: '#f8fafc',
              fontWeight: 800,
              fontSize: { xs: '1.5rem', md: '2rem' },
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {block.heading}
          </Typography>
          {block.body ? (
            <Typography sx={{ color: 'rgba(203,213,225,0.92)', fontSize: '1.05rem', lineHeight: 1.65 }}>
              {block.body}
            </Typography>
          ) : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
            <Button
              href={block.buttonUrl}
              variant="contained"
              size="large"
              sx={{
                background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
                color: '#0b1120',
                fontWeight: 700,
                fontSize: '1rem',
                textTransform: 'none',
                px: 3.5,
                py: 1.4,
                borderRadius: 1.5,
                boxShadow: '0 8px 24px rgba(167,139,250,0.4)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 32px rgba(167,139,250,0.5)',
                },
              }}
            >
              {block.buttonLabel}
            </Button>
            {block.secondaryLabel && block.secondaryUrl ? (
              <Button
                href={block.secondaryUrl}
                variant="outlined"
                size="large"
                sx={{
                  color: 'rgba(203,213,225,0.95)',
                  borderColor: 'rgba(148,163,184,0.4)',
                  borderWidth: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  py: 1.4,
                  borderRadius: 1.5,
                  '&:hover': {
                    borderColor: 'rgba(203,213,225,0.7)',
                    borderWidth: 1.5,
                    bgcolor: 'rgba(148,163,184,0.06)',
                  },
                }}
              >
                {block.secondaryLabel}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function FeatureListView({ block }: { block: FeatureListBlock }) {
  const items = (block.items ?? []).filter(Boolean);
  if (!items.length) return null;
  return (
    <Stack spacing={2.5}>
      {block.heading ? (
        <Typography
          component="h2"
          sx={{
            color: '#f8fafc',
            fontWeight: 700,
            fontSize: { xs: '1.35rem', md: '1.6rem' },
            letterSpacing: '-0.015em',
          }}
        >
          {block.heading}
        </Typography>
      ) : null}
      {block.style === 'bullets' ? (
        <Box component="ul" sx={{ pl: 3.5, m: 0, color: 'rgba(203,213,225,0.92)' }}>
          {items.map((it, i) => (
            <Box
              component="li"
              key={i}
              sx={{ mb: 1, fontSize: { xs: '1rem', md: '1.05rem' }, lineHeight: 1.65 }}
            >
              {it}
            </Box>
          ))}
        </Box>
      ) : (
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        >
          <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
            {items.map((it, i) => (
              <motion.div key={i} variants={STAGGER_CHILD_VARIANTS}>
                <Chip
                  label={it}
                  sx={{
                    background: 'linear-gradient(135deg, rgba(167,139,250,0.14), rgba(96,165,250,0.10))',
                    color: '#ddd6fe',
                    fontWeight: 500,
                    fontSize: '0.92rem',
                    border: '1px solid rgba(167,139,250,0.24)',
                    px: 0.8,
                    py: 2,
                    height: 36,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      border: '1px solid rgba(167,139,250,0.5)',
                      boxShadow: '0 4px 12px rgba(167,139,250,0.2)',
                    },
                  }}
                />
              </motion.div>
            ))}
          </Stack>
        </motion.div>
      )}
    </Stack>
  );
}

function RelatedStudiesView({ block }: { block: RelatedStudiesBlock }) {
  const items = (block.items ?? []).filter((s) => s.name || s.institution);
  if (!items.length) return null;
  return (
    <Stack spacing={2.5}>
      <Typography
        component="h2"
        sx={{
          color: '#f8fafc',
          fontWeight: 700,
          fontSize: { xs: '1.35rem', md: '1.6rem' },
          letterSpacing: '-0.015em',
        }}
      >
        {block.heading || 'Relaterte studier'}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 1.5,
        }}
      >
        {items.map((s, i) => (
          <Box
            key={i}
            sx={{
              p: 2,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.16)',
              background: 'rgba(2,6,23,0.42)',
              transition: 'all 0.2s ease',
              '&:hover': {
                border: '1px solid rgba(167,139,250,0.32)',
                bgcolor: 'rgba(167,139,250,0.04)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '1rem', mb: 0.4 }}>
              {s.name}
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.86rem' }}>
              {s.institution}
              {s.note ? ` · ${s.note}` : ''}
            </Typography>
          </Box>
        ))}
      </Box>
    </Stack>
  );
}

function UsageExamplesView({ block }: { block: UsageExamplesBlock }) {
  const items = (block.items ?? []).filter((it) => it.title || it.body);
  if (!items.length) return null;
  return (
    <Stack spacing={3}>
      <Typography
        component="h2"
        sx={{
          color: '#f8fafc',
          fontWeight: 700,
          fontSize: { xs: '1.5rem', md: '2rem' },
          letterSpacing: '-0.015em',
        }}
      >
        {block.heading || 'Bruks-eksempler'}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2.5,
        }}
      >
        {items.map((it, i) => (
          <Card
            key={i}
            sx={{
              bgcolor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              transition: 'all 0.25s ease',
              '&:hover': {
                bgcolor: 'rgba(167,139,250,0.05)',
                border: '1px solid rgba(167,139,250,0.32)',
                transform: 'translateY(-3px)',
                boxShadow: '0 12px 24px rgba(0,0,0,0.2)',
              },
            }}
          >
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Typography
                sx={{
                  color: '#f8fafc',
                  fontWeight: 700,
                  fontSize: { xs: '1.05rem', md: '1.15rem' },
                  mb: 1.2,
                  letterSpacing: '-0.01em',
                }}
              >
                {it.title}
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(203,213,225,0.86)',
                  fontSize: '0.95rem',
                  lineHeight: 1.65,
                }}
              >
                {it.body}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  );
}

function ImageView({ block }: { block: ImageBlock }) {
  if (!block.src) return null;
  return (
    <Stack spacing={1.2} alignItems="center">
      <Box
        component="img"
        src={block.src}
        alt={block.alt}
        loading="lazy"
        sx={{
          maxWidth: block.maxWidth ? `${block.maxWidth}px` : '100%',
          width: '100%',
          height: 'auto',
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
        }}
      />
      {block.caption ? (
        <Typography
          sx={{
            color: 'rgba(148,163,184,0.78)',
            fontSize: '0.86rem',
            fontStyle: 'italic',
            textAlign: 'center',
            mt: 0.8,
          }}
        >
          {block.caption}
        </Typography>
      ) : null}
    </Stack>
  );
}
