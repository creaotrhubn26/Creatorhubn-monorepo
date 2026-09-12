/**
 * blog-post.tsx — /blog/:slug
 *
 * Detalj-side for én blog-artikkel. Renderer markdown med headings,
 * lists, bold, italic, links, blockquotes, og inline code.
 *
 * SEO: title + description + Open Graph + JSON-LD BlogPosting.
 * GEO: skreddersydd for LLM-citation (clear headings, key sections).
 */

import {
  Alert, Box, Chip, CircularProgress, Container, Stack, Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { trackPageView, trackEvent } from '@/utils/ga4-client-tracking';

const palette = {
  bgRoot: '#0a0118',
  bgShell: '#0f0721',
  bgCard: '#150b2e',
  bgElevated: '#1a0f3a',
  border: 'rgba(168, 85, 247, 0.18)',
  borderStrong: 'rgba(168, 85, 247, 0.32)',
  borderSubtle: 'rgba(168, 85, 247, 0.08)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#8b7ec4',
  accentBright: '#c084fc',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
};

const PILLAR_LABELS: Record<string, string> = {
  gdpr: 'GDPR + Compliance',
  selftape: 'Self-tape-praksis',
  crm: 'Casting-CRM',
  ai: 'AI i casting',
  survey: 'Bransje-innsikt',
  cases: 'Case studies',
};

const PILLAR_COLORS: Record<string, string> = {
  gdpr: '#34d399',
  selftape: '#60a5fa',
  crm: '#fbbf24',
  ai: '#c084fc',
  survey: '#f87171',
  cases: '#e879f9',
};

interface Article {
  slug: string;
  public_slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  pillar: string | null;
  author: string | null;
  author_role: string | null;
  published_at: string | null;
  updated_at: string | null;
  reading_minutes: number;
  cover_image: string | null;
  tags: string[] | null;
  body_markdown: string;
}

interface Related {
  slug: string;
  public_slug: string;
  title: string;
  excerpt: string | null;
  published_at: string | null;
}

export default function BlogPostPage() {
  const [, params] = useRoute<{ slug: string }>('/blog/:slug');
  const slug = params?.slug ?? '';
  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<Related[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/public/blog/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (r.status === 404) throw new Error('not_found');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setArticle(data.article);
        setRelated(data.related ?? []);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Klarte ikke å hente artikkel');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  // GA4 page-view + article-view-event.
  useEffect(() => {
    if (!article) return;
    trackPageView(`/blog/${article.public_slug}`, article.title);
    trackEvent('blog_article_view', {
      slug: article.public_slug,
      pillar: article.pillar ?? 'unknown',
      reading_minutes: article.reading_minutes,
      surface: 'blog_post',
    });
  }, [article]);

  // GA4 scroll-depth — fire ved 25/50/75/100%.
  useEffect(() => {
    if (!article) return;
    const fired = new Set<number>();
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const pct = Math.round((window.scrollY / total) * 100);
      [25, 50, 75, 100].forEach((threshold) => {
        if (pct >= threshold && !fired.has(threshold)) {
          fired.add(threshold);
          trackEvent('scroll_depth', {
            surface: 'blog_post',
            slug: article.public_slug,
            depth_pct: threshold,
          });
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [article]);

  // SEO + Open Graph + JSON-LD BlogPosting
  useEffect(() => {
    if (!article) return;
    const previousTitle = document.title;
    document.title = `${article.title} — The Role Room`;

    const upsertMeta = (name: string, content: string, isProp = false) => {
      const attr = isProp ? 'property' : 'name';
      let tag = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, name);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
      return tag;
    };

    const description = article.excerpt ?? article.subtitle ?? '';
    const articleUrl = `https://theroleroom.com/blog/${article.public_slug}`;
    const tags = [
      upsertMeta('description', description),
      upsertMeta('og:title', article.title, true),
      upsertMeta('og:description', description, true),
      upsertMeta('og:type', 'article', true),
      upsertMeta('og:url', articleUrl, true),
      upsertMeta('og:locale', 'nb_NO', true),
      ...(article.cover_image ? [upsertMeta('og:image', article.cover_image, true)] : []),
      upsertMeta('twitter:card', 'summary_large_image'),
      upsertMeta('twitter:title', article.title),
      upsertMeta('twitter:description', description),
      upsertMeta('article:published_time', article.published_at ?? '', true),
      upsertMeta('article:author', article.author ?? 'The Role Room', true),
    ];

    // JSON-LD BlogPosting
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: article.title,
      description,
      datePublished: article.published_at,
      dateModified: article.updated_at,
      author: {
        '@type': 'Person',
        name: article.author ?? 'The Role Room',
        ...(article.author_role ? { jobTitle: article.author_role } : {}),
      },
      publisher: {
        '@type': 'Organization',
        name: 'The Role Room',
        url: 'https://theroleroom.com',
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': articleUrl,
      },
      ...(article.cover_image ? { image: article.cover_image } : {}),
      ...(article.tags ? { keywords: article.tags.join(', ') } : {}),
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'blog-jsonld';
    script.textContent = JSON.stringify(ld);
    document.head.appendChild(script);

    return () => {
      document.title = previousTitle;
      tags.forEach((t) => t.remove?.());
      document.getElementById('blog-jsonld')?.remove();
    };
  }, [article]);

  if (loading) {
    return (
      <Box sx={{ bgcolor: palette.bgRoot, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} sx={{ color: palette.accentBright }} />
      </Box>
    );
  }

  if (error === 'not_found' || !article) {
    return (
      <Box sx={{ bgcolor: palette.bgRoot, color: palette.textPrimary, minHeight: '100vh' }}>
        <Container maxWidth="sm" sx={{ pt: 10, textAlign: 'center' }}>
          <Typography component="h1" sx={{ fontSize: '2rem', fontWeight: 800, mb: 2 }}>
            Artikkel ikke funnet
          </Typography>
          <Typography sx={{ color: palette.textSecondary, mb: 3 }}>
            Lenken du fulgte er ikke gyldig, eller artikkelen er ikke publisert.
          </Typography>
          <Box
            component="a"
            href="/blog"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              color: palette.accentBright,
              textDecoration: 'none',
              fontWeight: 700,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            <ArrowBackIcon fontSize="small" />
            Tilbake til Blog
          </Box>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ bgcolor: palette.bgRoot, color: palette.textPrimary, minHeight: '100vh' }}>
        <Container maxWidth="md" sx={{ pt: 10 }}>
          <Alert severity="error">{error}</Alert>
        </Container>
      </Box>
    );
  }

  const pillarColor = article.pillar
    ? PILLAR_COLORS[article.pillar] ?? palette.accentBright
    : palette.accentBright;
  const pillarLabel = article.pillar
    ? PILLAR_LABELS[article.pillar] ?? article.pillar
    : null;
  const publishedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString('nb-NO', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  return (
    <Box sx={{ bgcolor: palette.bgRoot, color: palette.textPrimary, minHeight: '100vh' }}>
      {/* Top-nav */}
      <Box sx={{ borderBottom: `1px solid ${palette.borderSubtle}`, bgcolor: 'rgba(10,1,24,0.85)', backdropFilter: 'blur(8px)' }}>
        <Container maxWidth="md">
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 2 }}>
            <Box
              component="a"
              href="/blog"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.6,
                color: palette.textMuted,
                fontSize: '0.86rem',
                fontWeight: 600,
                textDecoration: 'none',
                '&:hover': { color: palette.accentBright },
              }}
            >
              <ArrowBackIcon fontSize="small" />
              Alle artikler
            </Box>
            <Box
              component="a"
              href="/for-byraer"
              sx={{
                color: palette.textMuted,
                fontSize: '0.86rem',
                fontWeight: 600,
                textDecoration: 'none',
                '&:hover': { color: palette.accentBright },
              }}
            >
              The Role Room →
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* Header */}
      <Container maxWidth="md" sx={{ pt: { xs: 4, md: 6 }, pb: 2 }}>
        {pillarLabel ? (
          <Chip
            label={pillarLabel}
            sx={{
              bgcolor: `${pillarColor}22`,
              color: pillarColor,
              fontWeight: 700,
              mb: 2.4,
            }}
          />
        ) : null}
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: '1.8rem', sm: '2.4rem', md: '3rem' },
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: -0.4,
            mb: 1.6,
          }}
        >
          {article.title}
        </Typography>
        {article.subtitle ? (
          <Typography sx={{ color: palette.textSecondary, fontSize: '1.08rem', lineHeight: 1.55, mb: 3 }}>
            {article.subtitle}
          </Typography>
        ) : null}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.94rem' }}>
              {article.author ?? 'The Role Room'}
            </Typography>
            {article.author_role ? (
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                {article.author_role}
              </Typography>
            ) : null}
          </Box>
          <Box sx={{ flex: 1 }} />
          {publishedDate ? (
            <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem' }}>
              {publishedDate} · {article.reading_minutes} min
            </Typography>
          ) : null}
        </Stack>
      </Container>

      {/* Body */}
      <Container maxWidth="md" sx={{ pb: 6 }}>
        <Box sx={{ height: 1, bgcolor: palette.borderSubtle, my: 4 }} />
        <MarkdownBody markdown={article.body_markdown} />
      </Container>

      {/* CTA */}
      <Container maxWidth="md" sx={{ pb: 6 }}>
        <Box
          sx={{
            textAlign: 'center',
            p: { xs: 3, md: 4 },
            bgcolor: 'rgba(168,85,247,0.08)',
            border: `1px solid ${palette.borderStrong}`,
            borderRadius: 3,
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', mb: 1 }}>
            Klar for å se hvordan vi løser dette i praksis?
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.96rem', mb: 2 }}>
            30-min demo med din egen casting-dag på vår plattform.
          </Typography>
          <Box
            component="a"
            href="/for-byraer#book-demo"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
              background: palette.accentGradient,
              color: '#fff',
              textDecoration: 'none',
              textTransform: 'none',
              fontWeight: 700,
              px: 3.2, py: 1.4,
              borderRadius: 2,
              '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
            }}
          >
            Book demo
            <ArrowForwardIcon fontSize="small" />
          </Box>
        </Box>
      </Container>

      {/* Related */}
      {related.length > 0 ? (
        <Container maxWidth="md" sx={{ pb: 8 }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', fontWeight: 700, letterSpacing: 1, mb: 2, textTransform: 'uppercase' }}>
            Relaterte artikler
          </Typography>
          <Stack spacing={1.6}>
            {related.map((r) => (
              <Box
                key={r.slug}
                component="a"
                href={`/blog/${r.public_slug}`}
                sx={{
                  display: 'block',
                  p: 2.4,
                  bgcolor: palette.bgCard,
                  border: `1px solid ${palette.borderSubtle}`,
                  borderRadius: 2,
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'border-color 0.18s',
                  '&:hover': { borderColor: palette.accentBright },
                }}
              >
                <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: palette.textPrimary, mb: 0.6 }}>
                  {r.title}
                </Typography>
                {r.excerpt ? (
                  <Typography sx={{ color: palette.textSecondary, fontSize: '0.88rem', lineHeight: 1.55 }}>
                    {r.excerpt}
                  </Typography>
                ) : null}
              </Box>
            ))}
          </Stack>
        </Container>
      ) : null}
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// Light-weight markdown renderer
// ──────────────────────────────────────────────────────────────────

function MarkdownBody({ markdown }: { markdown: string }) {
  const blocks = parseMarkdown(markdown);
  return (
    <Box
      sx={{
        '& h2': {
          fontSize: { xs: '1.4rem', md: '1.6rem' },
          fontWeight: 800,
          color: palette.textPrimary,
          mt: 5,
          mb: 2,
          lineHeight: 1.25,
          scrollMarginTop: 80,
        },
        '& h3': {
          fontSize: { xs: '1.15rem', md: '1.25rem' },
          fontWeight: 700,
          color: palette.textPrimary,
          mt: 4,
          mb: 1.4,
          lineHeight: 1.3,
        },
        '& p': {
          fontSize: '1rem',
          lineHeight: 1.75,
          color: palette.textSecondary,
          mb: 2.4,
        },
        '& strong': { color: palette.textPrimary, fontWeight: 700 },
        '& em': { color: palette.textPrimary },
        '& a': { color: palette.accentBright, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
        '& blockquote': {
          borderLeft: `3px solid ${palette.accentBright}`,
          bgcolor: 'rgba(168,85,247,0.08)',
          pl: 2.4,
          pr: 2.4,
          py: 1.6,
          my: 3,
          borderRadius: '0 8px 8px 0',
          color: palette.textPrimary,
          fontStyle: 'italic',
        },
        '& ul, & ol': {
          color: palette.textSecondary,
          fontSize: '1rem',
          lineHeight: 1.75,
          mb: 2.4,
          pl: 3,
        },
        '& li': { mb: 0.8 },
        '& code': {
          bgcolor: palette.bgElevated,
          color: palette.accentBright,
          px: 0.6,
          py: 0.2,
          borderRadius: 0.6,
          fontSize: '0.9em',
          fontFamily: '"SFMono-Regular", Menlo, Monaco, Consolas, monospace',
        },
        '& hr': {
          border: 'none',
          height: 1,
          bgcolor: palette.borderSubtle,
          my: 5,
        },
        '& figure.body-figure': {
          margin: '32px 0',
          padding: 0,
          borderRadius: 12,
          overflow: 'hidden',
          border: `1px solid ${palette.borderSubtle}`,
          bgcolor: palette.bgCard,
        },
        '& figure.body-figure img': {
          display: 'block',
          width: '100%',
          height: 'auto',
          maxHeight: 540,
          objectFit: 'cover',
        },
        '& figure.body-figure figcaption': {
          padding: '12px 18px',
          color: palette.textMuted,
          fontSize: '0.84rem',
          fontStyle: 'italic',
          borderTop: `1px solid ${palette.borderSubtle}`,
          textAlign: 'center',
        },
      }}
    >
      {blocks}
    </Box>
  );
}

interface BlockBase { id: number }
type Block =
  | (BlockBase & { type: 'h2' | 'h3'; text: string })
  | (BlockBase & { type: 'p'; text: string })
  | (BlockBase & { type: 'blockquote'; text: string })
  | (BlockBase & { type: 'hr' })
  | (BlockBase & { type: 'ul' | 'ol'; items: string[] })
  | (BlockBase & { type: 'figure'; alt: string; src: string; caption: string });

function parseMarkdown(md: string): React.ReactElement[] {
  const lines = md.split('\n');
  const blocks: Block[] = [];
  let blockId = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push({ id: blockId++, type: 'hr' });
      i++;
      continue;
    }

    // Standalone image: ![alt](url) or ![alt](url "caption")
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]+)")?\)\s*$/);
    if (imgMatch) {
      blocks.push({
        id: blockId++,
        type: 'figure',
        alt: imgMatch[1] ?? '',
        src: imgMatch[2],
        caption: imgMatch[3] ?? '',
      });
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({ id: blockId++, type: 'h2', text: trimmed.substring(3) });
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      blocks.push({ id: blockId++, type: 'h3', text: trimmed.substring(4) });
      i++;
      continue;
    }
    if (trimmed.startsWith('> ')) {
      // Multi-line blockquote
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().substring(2));
        i++;
      }
      blocks.push({ id: blockId++, type: 'blockquote', text: quoteLines.join(' ') });
      continue;
    }
    // Lists
    const ulMatch = trimmed.match(/^[-*]\s+(.+)/);
    const olMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (ulMatch || olMatch) {
      const type: 'ul' | 'ol' = ulMatch ? 'ul' : 'ol';
      const items: string[] = [];
      const matcher = ulMatch
        ? /^[-*]\s+(.+)/
        : /^\d+\.\s+(.+)/;
      while (i < lines.length) {
        const m = lines[i].trim().match(matcher);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push({ id: blockId++, type, items });
      continue;
    }
    // Paragraph (consume until blank line or new block-marker)
    const paragraphLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next) break;
      if (next.startsWith('## ') || next.startsWith('### ')) break;
      if (next.startsWith('> ')) break;
      if (next.startsWith('- ') || next.startsWith('* ')) break;
      if (/^\d+\.\s+/.test(next)) break;
      if (next === '---' || next === '***') break;
      if (/^!\[[^\]]*\]\([^)]+\)$/.test(next)) break;
      paragraphLines.push(lines[i]);
      i++;
    }
    blocks.push({ id: blockId++, type: 'p', text: paragraphLines.join(' ').trim() });
  }

  return blocks.map((b) => {
    switch (b.type) {
      case 'h2': return <h2 key={b.id}>{renderInline(b.text)}</h2>;
      case 'h3': return <h3 key={b.id}>{renderInline(b.text)}</h3>;
      case 'p':  return <p key={b.id}>{renderInline(b.text)}</p>;
      case 'blockquote': return <blockquote key={b.id}>{renderInline(b.text)}</blockquote>;
      case 'hr': return <hr key={b.id} />;
      case 'ul': return <ul key={b.id}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>;
      case 'ol': return <ol key={b.id}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ol>;
      case 'figure':
        return (
          <figure key={b.id} className="body-figure">
            <img src={b.src} alt={b.alt} loading="lazy" />
            {b.caption ? <figcaption>{b.caption}</figcaption> : null}
          </figure>
        );
    }
  });
}

function renderInline(text: string): React.ReactNode[] {
  // Pattern: [text](url), **bold**, *italic*, `code`
  const out: React.ReactNode[] = [];
  let key = 0;
  let remaining = text;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Match link
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const italicMatch = remaining.match(/\*([^*]+)\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);

    const matches: Array<{ idx: number; match: RegExpMatchArray; kind: 'link' | 'bold' | 'italic' | 'code' }> = [];
    if (linkMatch) matches.push({ idx: linkMatch.index!, match: linkMatch, kind: 'link' });
    if (boldMatch) matches.push({ idx: boldMatch.index!, match: boldMatch, kind: 'bold' });
    if (italicMatch) matches.push({ idx: italicMatch.index!, match: italicMatch, kind: 'italic' });
    if (codeMatch) matches.push({ idx: codeMatch.index!, match: codeMatch, kind: 'code' });

    if (matches.length === 0) {
      if (remaining) out.push(<span key={`s${key++}`}>{remaining}</span>);
      break;
    }
    matches.sort((a, b) => a.idx - b.idx);
    const first = matches[0];
    if (first.idx > 0) out.push(<span key={`s${key++}`}>{remaining.substring(0, first.idx)}</span>);

    if (first.kind === 'link') {
      out.push(<a key={`l${key++}`} href={first.match[2]}>{first.match[1]}</a>);
    } else if (first.kind === 'bold') {
      out.push(<strong key={`b${key++}`}>{first.match[1]}</strong>);
    } else if (first.kind === 'italic') {
      out.push(<em key={`i${key++}`}>{first.match[1]}</em>);
    } else if (first.kind === 'code') {
      out.push(<code key={`c${key++}`}>{first.match[1]}</code>);
    }
    remaining = remaining.substring(first.idx + first.match[0].length);
  }
  return out;
}
