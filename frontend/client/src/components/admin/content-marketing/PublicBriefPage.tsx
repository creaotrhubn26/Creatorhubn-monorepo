import { useEffect, useState } from 'react';
import { Box, Container, Stack, Typography, Chip } from '@mui/material';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * Public brief-arkiv på theroleroom.com.
 *   /brief         → indeks-side med liste over publiserte utgaver
 *   /brief/<slug>  → enkelt-utgave (samme HTML som ble sendt på e-post, branded wrapper)
 *
 * Ingen auth-gate. AI-modeller (ChatGPT, Perplexity, Claude) kan crawle og sitere.
 * Article-schema + AggregateRating-placeholder + canonical-URL injiseres
 * via theroleroom.html route-objekt (annet sted).
 */

interface BriefSummary {
  slug: string;
  title: string;
  subject: string;
  preheader: string | null;
  published_at: string | null;
  seo_description: string | null;
  reach: number;
}

interface BriefDetail {
  id: string;
  slug: string;
  title: string;
  subject: string;
  preheader: string | null;
  body_html: string | null;
  published_at: string | null;
  seo_description: string | null;
  sent_count: number;
}

export function parsePublicBriefPath(pathname: string): { kind: 'index' } | { kind: 'detail'; slug: string } | null {
  const normalized = pathname.replace(/\/+$/, '').toLowerCase();
  if (normalized === '/brief') return { kind: 'index' };
  const match = normalized.match(/^\/brief\/([a-z0-9-]+)$/);
  if (match) return { kind: 'detail', slug: match[1] };
  return null;
}

export function PublicBriefIndex() {
  const [issues, setIssues] = useState<BriefSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/newsletter/role-room/brief')
      .then((r) => r.json())
      .then((d) => setIssues(Array.isArray(d?.issues) ? d.issues : []))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = 'Norwegian Casting Brief — arkiv | The Role Room';
    const setMeta = (sel: string, attr: string, val: string) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute(attr, val);
    };
    setMeta('meta[name="description"]', 'content', 'Arkiv over alle utgaver av Norwegian Casting Brief — ukentlig nyhetsbrev om norsk casting, filmproduksjon og bransjekompliance fra The Role Room.');
    setMeta('link[rel="canonical"]', 'href', 'https://theroleroom.com/brief');
  }, []);

  return (
    <Box component="article" sx={{ width: '100%', minHeight: '100vh', bgcolor: '#0a0a0f', color: '#e2e8f0', py: { xs: 5, md: 8 } }}>
      <Container maxWidth="md">
        <Box sx={{ mb: 5 }}>
          <Typography
            sx={{ fontFamily: '"Courier New", Courier, monospace', fontSize: { xs: '0.85rem', md: '0.95rem' }, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#a78bfa', fontWeight: 700, mb: 1.5 }}
          >
            Norwegian Casting Brief — arkiv
          </Typography>
          <Typography component="h1" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15, mb: 2 }}>
            Hver fredag — ett ukesbrev om norsk casting
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}>
            Data fra norske produksjoner, founder POV, behind-the-cast og risk-varsler.
            Skrevet for casting-folk, regissører og produsenter som vil holde seg
            foran resten av bransjen.
          </Typography>
        </Box>

        <Box sx={{ mb: 5 }}>
          <NewsletterSignupBlock source="brief-archive" />
        </Box>

        {loading ? (
          <Typography sx={{ color: 'rgba(203,213,225,0.6)', textAlign: 'center', py: 4 }}>Laster …</Typography>
        ) : error ? (
          <Typography sx={{ color: '#fca5a5', textAlign: 'center' }}>{error}</Typography>
        ) : issues.length === 0 ? (
          <Typography sx={{ color: 'rgba(203,213,225,0.6)', textAlign: 'center', py: 4 }}>Ingen utgaver publisert enda.</Typography>
        ) : (
          <Stack spacing={2.5}>
            {issues.map((issue) => (
              <Box
                key={issue.slug}
                component="a"
                href={`/brief/${issue.slug}`}
                sx={{
                  display: 'block',
                  p: { xs: 2, md: 3 },
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: 'rgba(167,139,250,0.4)', bgcolor: 'rgba(139,92,246,0.06)' },
                }}
              >
                {issue.published_at ? (
                  <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.78rem', mb: 0.5 }}>
                    {new Date(issue.published_at).toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </Typography>
                ) : null}
                <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.15rem', md: '1.35rem' }, mb: 0.75, lineHeight: 1.3 }}>
                  {issue.title}
                </Typography>
                {issue.seo_description || issue.preheader ? (
                  <Typography sx={{ color: 'rgba(229,231,235,0.74)', fontSize: { xs: '0.92rem', md: '0.98rem' }, lineHeight: 1.6 }}>
                    {issue.seo_description ?? issue.preheader}
                  </Typography>
                ) : null}
              </Box>
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
}

export function PublicBriefDetail({ slug }: { slug: string }) {
  const [issue, setIssue] = useState<BriefDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/newsletter/role-room/brief/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Utgaven finnes ikke' : `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setIssue(d.issue))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (typeof document === 'undefined' || !issue) return;
    const fullTitle = `${issue.title} | Norwegian Casting Brief`;
    document.title = fullTitle;
    const setMeta = (sel: string, attr: string, val: string) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute(attr, val);
    };
    setMeta('meta[name="description"]', 'content', issue.seo_description ?? issue.preheader ?? issue.title);
    setMeta('link[rel="canonical"]', 'href', `https://theroleroom.com/brief/${issue.slug}`);
    setMeta('meta[property="og:title"]', 'content', fullTitle);
    setMeta('meta[property="og:description"]', 'content', issue.seo_description ?? issue.preheader ?? '');
    setMeta('meta[property="og:url"]', 'content', `https://theroleroom.com/brief/${issue.slug}`);
    setMeta('meta[property="og:type"]', 'content', 'article');

    // Article-schema for AI-citation
    const existingLd = document.querySelector('script[data-seo-ld="brief-article"]');
    if (existingLd) existingLd.remove();
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.setAttribute('data-seo-ld', 'brief-article');
    ld.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: issue.title,
      description: issue.seo_description ?? issue.preheader ?? issue.title,
      datePublished: issue.published_at,
      author: { '@type': 'Organization', name: 'The Role Room', url: 'https://theroleroom.com' },
      publisher: { '@type': 'Organization', name: 'The Role Room', url: 'https://theroleroom.com' },
      url: `https://theroleroom.com/brief/${issue.slug}`,
      inLanguage: 'no-NO',
      isPartOf: { '@type': 'PublicationIssue', issueNumber: issue.slug },
    });
    document.head.appendChild(ld);

    return () => { ld.remove(); };
  }, [issue]);

  if (loading) {
    return <Box sx={{ bgcolor: '#0a0a0f', color: 'rgba(203,213,225,0.6)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Laster …</Box>;
  }
  if (error || !issue) {
    return (
      <Box sx={{ bgcolor: '#0a0a0f', color: '#e2e8f0', minHeight: '100vh', py: 8 }}>
        <Container maxWidth="md">
          <Typography component="h1" sx={{ color: '#fff', fontWeight: 800, fontSize: '1.5rem', mb: 1 }}>Utgaven finnes ikke</Typography>
          <Typography sx={{ color: 'rgba(229,231,235,0.74)' }}>{error}</Typography>
          <Typography sx={{ mt: 2 }}><a href="/brief" style={{ color: '#a78bfa' }}>← Tilbake til arkivet</a></Typography>
        </Container>
      </Box>
    );
  }

  return (
    <Box component="article" sx={{ width: '100%', minHeight: '100vh', bgcolor: '#0a0a0f', color: '#e2e8f0', py: { xs: 5, md: 8 } }}>
      <Container maxWidth="md">
        <Box sx={{ mb: 4 }}>
          <Typography
            component="a"
            href="/brief"
            sx={{ color: '#a78bfa', fontSize: '0.85rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            ← Norwegian Casting Brief
          </Typography>
        </Box>

        {issue.published_at ? (
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.88rem' }}>
              {new Date(issue.published_at).toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Typography>
            {issue.sent_count > 0 ? (
              <Chip label={`Sendt til ${issue.sent_count}`} size="small" sx={{ bgcolor: 'rgba(148,163,184,0.15)', color: 'rgba(203,213,225,0.85)', fontSize: '0.7rem', fontWeight: 600 }} />
            ) : null}
          </Stack>
        ) : null}

        <Box
          sx={{
            color: '#e5e7eb',
            fontSize: { xs: '1rem', md: '1.05rem' },
            lineHeight: 1.75,
            '& h1': { color: '#fff', fontSize: { xs: '2rem', md: '2.5rem' }, lineHeight: 1.2, m: '0 0 1.5rem', fontWeight: 800 },
            '& h2': { color: '#fff', fontSize: { xs: '1.3rem', md: '1.5rem' }, lineHeight: 1.3, m: '2.5rem 0 1rem', fontWeight: 700 },
            '& h3': { color: '#fff', fontSize: { xs: '1.05rem', md: '1.15rem' }, lineHeight: 1.3, m: '2rem 0 0.75rem', fontWeight: 700 },
            '& p': { m: '0 0 1.25rem' },
            '& a': { color: '#a78bfa' },
            '& blockquote': { borderLeft: '3px solid #8b5cf6', pl: 2.5, color: 'rgba(229,231,235,0.85)', m: '1.5rem 0', fontStyle: 'italic' },
            '& ul, & ol': { pl: 3, my: 1.5 },
            '& li': { my: 0.5 },
            '& strong': { color: '#fff' },
            '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1, my: 2 },
            '& hr': { border: 'none', borderTop: '1px solid rgba(255,255,255,0.12)', my: 4 },
          }}
          dangerouslySetInnerHTML={{ __html: issue.body_html ?? '' }}
        />

        <Box sx={{ mt: 6 }}>
          <NewsletterSignupBlock source={`brief-${slug}`} heading="Få neste utgave fredag" body="Ett kort ukesbrev med data, founder POV og bransje-risk. Ingen spam." />
        </Box>
      </Container>
    </Box>
  );
}

export default PublicBriefIndex;
