/**
 * blog-index.tsx — /blog
 *
 * Offentlig blog-index. Liste over publiserte artikler fra cms_pages
 * (variant='blog'). Filter på pillar + tag via query-param.
 *
 * Bygd som standalone-side med samme branding som /for-byraer.
 */

import {
  Alert, Box, Button, Chip, CircularProgress, Container, Stack, Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useEffect, useState } from 'react';
import { trackPageView, trackEvent } from '@/utils/ga4-client-tracking';

const palette = {
  bgRoot: '#0a0118',
  bgShell: '#0f0721',
  bgCard: '#150b2e',
  border: 'rgba(168, 85, 247, 0.18)',
  borderStrong: 'rgba(168, 85, 247, 0.32)',
  borderSubtle: 'rgba(168, 85, 247, 0.08)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#8b7ec4',
  accentBright: '#c084fc',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
};

interface Article {
  slug: string;
  public_slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  pillar: string | null;
  author: string | null;
  cover_image: string | null;
  published_at: string | null;
  reading_minutes: number;
  tags: string[] | null;
}

// Pillar-taksonomi alignet mot THE-ROLE-ROOM-PRODUKTDOKUMENTASJON.md §2.1 vertikaler.
// Legacy-slugs (gdpr/selftape/crm) mappes til Talents-vertikalen siden de tre eksisterende
// artiklene dekker consent, self-tape og effektivisering — alle innenfor Talents-app/Registry.
const PILLAR_LABELS: Record<string, string> = {
  // Nye vertikal-baserte pillarer
  'production-os': 'Produksjons-OS',
  'content-producer': 'Innholdsprodusent',
  dance: 'Dansestudio',
  talents: 'Talents + Registry',
  agent: 'AI-Agent',
  'cross-cutting': 'På tvers',
  // Legacy-slugs (de tre eksisterende pillar-artiklene tilhører Talents-vertikalen)
  gdpr: 'Talents + GDPR',
  selftape: 'Talents + Self-tape',
  crm: 'På tvers · Effektivisering',
  ai: 'AI-Agent',
  survey: 'Bransje-innsikt',
  cases: 'Case studies',
};

const PILLAR_COLORS: Record<string, string> = {
  'production-os': '#60a5fa',
  'content-producer': '#fbbf24',
  dance: '#e879f9',
  talents: '#34d399',
  agent: '#c084fc',
  'cross-cutting': '#94a3b8',
  // Legacy
  gdpr: '#34d399',
  selftape: '#34d399',
  crm: '#94a3b8',
  ai: '#c084fc',
  survey: '#f87171',
  cases: '#e879f9',
};

export default function BlogIndexPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePillar, setActivePillar] = useState<string | null>(null);

  // GA4 page-view ved mount.
  useEffect(() => {
    trackPageView('/blog', 'Blog — The Role Room');
    trackEvent('landing_view', { landing: 'blog_index', surface: 'theroleroom.com' });
  }, []);

  // GA4 tracker pillar-filter-bytte.
  useEffect(() => {
    if (!activePillar) return;
    trackEvent('blog_filter_changed', { pillar: activePillar });
  }, [activePillar]);

  // SEO: title + description + JSON-LD CollectionPage
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Blog — The Role Room | Operativsystem for film- og innholdsproduksjon';
    const meta = document.querySelector('meta[name="description"]')
      ?? Object.assign(document.createElement('meta'), { name: 'description' });
    meta.setAttribute('content',
      'Innsikt på tvers av fire vertikaler — Produksjons-OS, Innholdsprodusent, Dansestudio og Talent Registry — for norske produksjonsteam, byråer og skapere.',
    );
    if (!meta.parentNode) document.head.appendChild(meta);
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const url = activePillar
      ? `/api/public/blog?pillar=${encodeURIComponent(activePillar)}`
      : '/api/public/blog';
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setArticles(data.articles ?? []);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Klarte ikke å hente artikler');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activePillar]);

  // Hent unike pillars fra artiklene for filter-knapper
  const pillarsInUse = Array.from(new Set(articles.map((a) => a.pillar).filter(Boolean) as string[]));

  return (
    <Box sx={{ bgcolor: palette.bgRoot, color: palette.textPrimary, minHeight: '100vh' }}>
      {/* Hero */}
      <Box
        sx={{
          background: `
            radial-gradient(ellipse at top, rgba(168, 85, 247, 0.18), transparent 60%),
            ${palette.bgRoot}
          `,
          pt: { xs: 6, md: 10 },
          pb: { xs: 4, md: 6 },
        }}
      >
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
            Blog
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: '2rem', md: '3rem' },
              fontWeight: 800,
              lineHeight: 1.1,
              mb: 2,
            }}
          >
            Innsikt for{' '}
            <Box component="span" sx={{
              background: palette.accentGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              norske casting-byråer
            </Box>
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '1.08rem' }}>
            Innsikt på tvers av de fire vertikalene i operativsystemet vårt — Produksjons-OS, Innholdsprodusent, Dansestudio og Talent Registry.
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ pb: { xs: 6, md: 10 } }}>
        {/* Pillar-filter */}
        {pillarsInUse.length > 1 || activePillar ? (
          <Stack
            direction="row"
            spacing={1}
            sx={{
              mb: 4,
              overflowX: 'auto',
              pb: 1,
              flexWrap: { sm: 'wrap' },
              gap: 1,
            }}
          >
            <Button
              onClick={() => setActivePillar(null)}
              sx={pillarBtnSx(!activePillar)}
            >
              Alle
            </Button>
            {pillarsInUse.map((p) => (
              <Button
                key={p}
                onClick={() => setActivePillar(p)}
                sx={pillarBtnSx(activePillar === p)}
              >
                {PILLAR_LABELS[p] ?? p}
              </Button>
            ))}
          </Stack>
        ) : null}

        {error ? <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert> : null}

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress size={28} sx={{ color: palette.accentBright }} />
          </Box>
        ) : articles.length === 0 ? (
          <Box
            sx={{
              bgcolor: palette.bgCard,
              border: `1px dashed ${palette.borderSubtle}`,
              borderRadius: 2,
              p: 5,
              textAlign: 'center',
            }}
          >
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 0.8 }}>
              Ingen artikler ennå
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem' }}>
              Den første pillar-artikkelen kommer snart.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: { xs: 2, md: 3 },
            }}
          >
            {articles.map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </Box>
        )}

        {/* CTA */}
        <Box
          sx={{
            mt: 6,
            textAlign: 'center',
            p: { xs: 3, md: 4 },
            bgcolor: 'rgba(168,85,247,0.08)',
            border: `1px solid ${palette.borderStrong}`,
            borderRadius: 3,
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', mb: 1 }}>
            Vil du se hele operativsystemet — fra idé til sett?
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.96rem', mb: 2 }}>
            30-min demo skreddersydd for din vertikal — produksjonsteam, innholdsprodusent, dansestudio eller byrå.
          </Typography>
          <Button
            href="/for-byraer#book-demo"
            endIcon={<ArrowForwardIcon />}
            sx={{
              background: palette.accentGradient,
              color: '#fff',
              textTransform: 'none',
              fontWeight: 700,
              px: 3, py: 1.4,
              borderRadius: 2,
              '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
            }}
          >
            Book demo
          </Button>
        </Box>
      </Container>
    </Box>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const pillarColor = article.pillar
    ? PILLAR_COLORS[article.pillar] ?? palette.accentBright
    : palette.accentBright;
  const pillarLabel = article.pillar
    ? PILLAR_LABELS[article.pillar] ?? article.pillar
    : null;
  const onClick = () => {
    trackEvent('blog_article_click', {
      slug: article.public_slug,
      pillar: article.pillar ?? 'unknown',
      surface: 'blog_index',
    });
  };

  return (
    <Box
      component="a"
      href={`/blog/${article.public_slug}`}
      onClick={onClick}
      sx={{
        bgcolor: palette.bgCard,
        border: `1px solid ${palette.borderSubtle}`,
        borderRadius: 3,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.18s, transform 0.18s',
        '&:hover': {
          borderColor: palette.borderStrong,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Box
        sx={{
          aspectRatio: '16 / 9',
          background: article.cover_image
            ? `linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${article.cover_image})`
            : `linear-gradient(135deg, ${pillarColor}28, ${palette.bgCard})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!article.cover_image && pillarLabel ? (
          <Typography sx={{
            color: pillarColor,
            opacity: 0.4,
            fontSize: { xs: '1.6rem', md: '2.4rem' },
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            {pillarLabel.split(' ')[0]}
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ p: 2.4, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {pillarLabel ? (
          <Chip
            label={pillarLabel}
            size="small"
            sx={{
              alignSelf: 'flex-start',
              bgcolor: `${pillarColor}22`,
              color: pillarColor,
              fontWeight: 700,
              fontSize: '0.72rem',
              mb: 1.4,
            }}
          />
        ) : null}
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: '1.1rem',
            lineHeight: 1.25,
            mb: 1,
            color: palette.textPrimary,
          }}
        >
          {article.title}
        </Typography>
        {article.excerpt ? (
          <Typography
            sx={{
              color: palette.textSecondary,
              fontSize: '0.92rem',
              lineHeight: 1.55,
              mb: 2,
              flex: 1,
            }}
          >
            {article.excerpt}
          </Typography>
        ) : null}
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 'auto' }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
            {article.author ?? 'The Role Room'}
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
            {article.reading_minutes} min
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

function pillarBtnSx(active: boolean) {
  return {
    flexShrink: 0,
    textTransform: 'none' as const,
    fontWeight: 700,
    fontSize: '0.86rem',
    px: 2,
    py: 1,
    borderRadius: 999,
    bgcolor: active ? 'rgba(168,85,247,0.18)' : 'transparent',
    color: active ? palette.accentBright : palette.textMuted,
    border: `1px solid ${active ? palette.accentBright : palette.borderSubtle}`,
    '&:hover': { bgcolor: 'rgba(168,85,247,0.10)', color: palette.textPrimary },
  };
}
