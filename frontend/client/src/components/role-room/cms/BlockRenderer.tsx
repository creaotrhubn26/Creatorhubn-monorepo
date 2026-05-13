/**
 * BlockRenderer.tsx
 *
 * Frontend-renderer for block-CMS. Tar en `Block[]` og rendrer hver
 * blokk-type med riktig layout og styling. Brukes av SEO-sidene som
 * fallback fra hardkodet default når CMS leverer `content.blocks[]`.
 */

import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
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
import DOMPurify from 'dompurify';
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

export default function BlockRenderer({ blocks, locale = DEFAULT_LOCALE }: BlockRendererProps) {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
      <Stack spacing={4}>
        {blocks.map((block) => (
          <BlockView key={block.id} block={applyLocale(block, locale)} />
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
    <Stack spacing={2} sx={{ maxWidth: 820 }}>
      {block.audienceChip ? (
        <Chip
          label={block.audienceChip}
          size="small"
          sx={{
            alignSelf: 'flex-start',
            bgcolor: 'rgba(167,139,250,0.16)',
            color: '#ddd6fe',
            fontWeight: 600,
          }}
        />
      ) : null}
      <Typography
        component="h1"
        sx={{ color: '#f8fafc', fontWeight: 800, fontSize: { xs: '1.8rem', md: '2.6rem' }, lineHeight: 1.15 }}
      >
        {block.h1}
      </Typography>
      {block.subtitle ? (
        <Typography sx={{ color: 'rgba(203,213,225,0.86)', fontSize: { xs: '1rem', md: '1.15rem' }, lineHeight: 1.6 }}>
          {block.subtitle}
        </Typography>
      ) : null}
      {block.intro ? (
        <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.96rem', lineHeight: 1.7 }}>
          {block.intro}
        </Typography>
      ) : null}
      {(block.primaryCtaLabel || block.secondaryCtaLabel) ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
          {block.primaryCtaLabel ? (
            <Button
              href={block.primaryCtaUrl || '/'}
              variant="contained"
              size="large"
              sx={{
                bgcolor: '#a78bfa',
                color: '#0b1120',
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': { bgcolor: '#c4b5fd' },
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
                color: 'rgba(203,213,225,0.92)',
                borderColor: 'rgba(148,163,184,0.32)',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': { borderColor: 'rgba(203,213,225,0.6)', bgcolor: 'rgba(148,163,184,0.06)' },
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

// DOMPurify-config — kun trygge tags fra TipTap StarterKit + Link.
// Forbid `style`-attributter for å hindre style-injection-XSS.
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
    <Stack spacing={1.5}>
      {block.heading ? (
        <Typography component="h2" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
          {block.heading}
        </Typography>
      ) : null}
      {block.text ? (
        <Box
          sx={{
            color: 'rgba(203,213,225,0.86)',
            fontSize: '1rem',
            lineHeight: 1.7,
            '& p': { my: 1 },
            '& h1, & h2, & h3, & h4': { color: '#f8fafc', fontWeight: 700, mt: 2, mb: 1 },
            '& h2': { fontSize: { xs: '1.15rem', md: '1.4rem' } },
            '& h3': { fontSize: '1.05rem' },
            '& ul, & ol': { pl: 3, my: 1 },
            '& li': { mb: 0.5 },
            '& a': { color: '#a78bfa', textDecoration: 'underline' },
            '& strong': { color: '#f8fafc' },
            '& hr': { my: 2, borderColor: 'rgba(255,255,255,0.12)' },
            '& code': { bgcolor: 'rgba(255,255,255,0.08)', px: 0.6, py: 0.2, borderRadius: 0.5, fontSize: '0.92rem' },
            '& blockquote': { borderLeft: '3px solid rgba(167,139,250,0.5)', pl: 1.5, my: 1, color: 'rgba(203,213,225,0.95)' },
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.text) }}
        />
      ) : null}
    </Stack>
  );
}

function FaqView({ block }: { block: FaqBlock }) {
  if (!block.items?.length) return null;
  return (
    <Stack spacing={2}>
      <Typography component="h2" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
        {block.heading || 'Spørsmål og svar'}
      </Typography>
      <Stack spacing={1.5}>
        {block.items.filter((it) => it.q || it.a).map((item, i) => (
          <Card key={i} sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <CardContent>
              <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '1rem', mb: 1 }}>
                {item.q}
              </Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.86)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                {item.a}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function ComparisonView({ block }: { block: ComparisonBlock }) {
  if (!block.rows?.length) return null;
  return (
    <Stack spacing={2}>
      {block.heading ? (
        <Typography component="h2" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
          {block.heading}
        </Typography>
      ) : null}
      <TableContainer sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 1 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: 'rgba(203,213,225,0.78)', borderColor: 'rgba(255,255,255,0.08)' }}>Funksjon</TableCell>
              <TableCell align="center" sx={{ color: '#ddd6fe', fontWeight: 700, borderColor: 'rgba(255,255,255,0.08)' }}>
                The Role Room
              </TableCell>
              <TableCell align="center" sx={{ color: 'rgba(203,213,225,0.78)', borderColor: 'rgba(255,255,255,0.08)' }}>
                {block.competitorLabel}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {block.rows.filter((r) => r.feature).map((row, i) => (
              <TableRow key={i}>
                <TableCell sx={{ color: 'rgba(241,245,249,0.92)', borderColor: 'rgba(255,255,255,0.06)' }}>
                  {row.feature}
                </TableCell>
                <TableCell align="center" sx={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <SupportIcon value={row.roleRoom} />
                </TableCell>
                <TableCell align="center" sx={{ borderColor: 'rgba(255,255,255,0.06)' }}>
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
      return <CheckCircleIcon sx={{ color: '#86efac' }} />;
    case 'no':
      return <RemoveCircleOutlineIcon sx={{ color: 'rgba(203,213,225,0.5)' }} />;
    case 'partial':
      return <HelpOutlineIcon sx={{ color: '#fdba74' }} />;
    case 'unknown':
    default:
      return <HelpOutlineIcon sx={{ color: 'rgba(203,213,225,0.4)' }} />;
  }
}

function CtaView({ block }: { block: CtaBlock }) {
  return (
    <Card
      sx={{
        bgcolor: 'rgba(167,139,250,0.08)',
        border: '1px solid rgba(167,139,250,0.24)',
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Typography component="h2" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.25rem' }}>
            {block.heading}
          </Typography>
          {block.body ? (
            <Typography sx={{ color: 'rgba(203,213,225,0.86)', fontSize: '1rem', lineHeight: 1.6 }}>
              {block.body}
            </Typography>
          ) : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              href={block.buttonUrl}
              variant="contained"
              sx={{
                bgcolor: '#a78bfa',
                color: '#0b1120',
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': { bgcolor: '#c4b5fd' },
              }}
            >
              {block.buttonLabel}
            </Button>
            {block.secondaryLabel && block.secondaryUrl ? (
              <Button
                href={block.secondaryUrl}
                variant="outlined"
                sx={{
                  color: 'rgba(203,213,225,0.92)',
                  borderColor: 'rgba(148,163,184,0.32)',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': { borderColor: 'rgba(203,213,225,0.6)' },
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
    <Stack spacing={1.5}>
      {block.heading ? (
        <Typography component="h2" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.15rem' }}>
          {block.heading}
        </Typography>
      ) : null}
      {block.style === 'bullets' ? (
        <Box component="ul" sx={{ pl: 3, m: 0, color: 'rgba(203,213,225,0.86)' }}>
          {items.map((it, i) => (
            <Box component="li" key={i} sx={{ mb: 0.5, fontSize: '0.96rem', lineHeight: 1.6 }}>
              {it}
            </Box>
          ))}
        </Box>
      ) : (
        <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
          {items.map((it, i) => (
            <Chip
              key={i}
              label={it}
              sx={{ bgcolor: 'rgba(167,139,250,0.12)', color: '#ddd6fe', fontWeight: 500 }}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function RelatedStudiesView({ block }: { block: RelatedStudiesBlock }) {
  const items = (block.items ?? []).filter((s) => s.name || s.institution);
  if (!items.length) return null;
  return (
    <Stack spacing={1.5}>
      <Typography component="h2" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.15rem' }}>
        {block.heading || 'Relaterte studier'}
      </Typography>
      <Stack spacing={0.8}>
        {items.map((s, i) => (
          <Box
            key={i}
            sx={{
              p: 1.2,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.14)',
              background: 'rgba(2,6,23,0.34)',
            }}
          >
            <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.95rem' }}>
              {s.name}
            </Typography>
            <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.82rem' }}>
              {s.institution}
              {s.note ? ` · ${s.note}` : ''}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

function UsageExamplesView({ block }: { block: UsageExamplesBlock }) {
  const items = (block.items ?? []).filter((it) => it.title || it.body);
  if (!items.length) return null;
  return (
    <Stack spacing={2}>
      <Typography component="h2" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.25rem' }}>
        {block.heading || 'Bruks-eksempler'}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2,
        }}
      >
        {items.map((it, i) => (
          <Card key={i} sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <CardContent>
              <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '1rem', mb: 0.8 }}>
                {it.title}
              </Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.86)', fontSize: '0.92rem', lineHeight: 1.6 }}>
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
    <Stack spacing={1} alignItems="center">
      <Box
        component="img"
        src={block.src}
        alt={block.alt}
        sx={{
          maxWidth: block.maxWidth ? `${block.maxWidth}px` : '100%',
          height: 'auto',
          borderRadius: 1,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      />
      {block.caption ? (
        <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.82rem', fontStyle: 'italic' }}>
          {block.caption}
        </Typography>
      ) : null}
    </Stack>
  );
}
