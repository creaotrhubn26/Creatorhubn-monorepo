/**
 * Public CV-rendering side — /cv/:slug
 *
 * Vises uten innlogging når CV-eieren har klikket "Del offentlig". Henter
 * data fra /api/public/resumes/:slug (som returnerer 404 om CV-en ikke
 * er publisert) og rendrer den med valgt template.
 *
 * Inkluderer:
 *   • CreatorHub-footer ("Laget med CreatorHub ResumeBuilder")
 *   • Open-Graph + Twitter meta-tags for fin link-preview ved deling
 *   • "Skriv ut / Lagre som PDF"-knapp som bruker browser-print
 *   • View-count vises (når backend support er på plass)
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import {
  Box, Container, Typography, CircularProgress, Alert, Button, Stack, Paper, Link as MuiLink,
} from '@mui/material';
import { PictureAsPdf as PdfIcon, Launch as LaunchIcon } from '@mui/icons-material';
import {
  RESUME_TEMPLATES,
  ModernATSTemplate,
} from '@/components/resume/templates/ResumeTemplates';
import { apiRequest } from '@/lib/queryClient';

interface FullResumeData {
  resume: any;
  experiences: any[];
  education: any[];
  skills: any[];
  certifications: any[];
  projects: any[];
  languages: any[];
}

const PublicCV: React.FC = () => {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [data, setData] = useState<FullResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    apiRequest(`/api/public/resumes/${encodeURIComponent(slug)}`)
      .then((res) => {
        setData(res);
        setError(null);
        // GA4 — public CV view (telles allerede i DB, men dette gir
        // funnel-data om hvor besøkere kommer fra)
        if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
          (window as any).gtag('event', 'nextrole_public_cv_viewed', {
            slug,
            template_id: res?.resume?.templateId,
            referrer: document.referrer || 'direct',
          });
        }
        // Oppdater meta-tags så LinkedIn/Facebook/Twitter får fin preview.
        const fullName =
          res?.resume?.personalInfo?.fullName ?? res?.resume?.title ?? 'CV';
        const title = res?.resume?.personalInfo?.professionalTitle
          ? `${fullName} — ${res.resume.personalInfo.professionalTitle}`
          : fullName;
        document.title = `${title} | CreatorHub CV`;
        const setMeta = (selector: string, content: string) => {
          let el = document.querySelector(selector) as HTMLMetaElement | null;
          if (!el) {
            el = document.createElement('meta');
            const isProperty = selector.includes('property=');
            const match = selector.match(/(?:name|property)="([^"]+)"/);
            if (!match) return;
            el.setAttribute(isProperty ? 'property' : 'name', match[1]);
            document.head.appendChild(el);
          }
          el.content = content;
        };
        const description = res?.resume?.personalInfo?.summary
          ? String(res.resume.personalInfo.summary).slice(0, 200)
          : `CV for ${fullName}`;
        setMeta('meta[name="description"]', description);
        setMeta('meta[property="og:title"]', title);
        setMeta('meta[property="og:description"]', description);
        setMeta('meta[property="og:type"]', 'profile');
        setMeta('meta[name="twitter:card"]', 'summary_large_image');
        setMeta('meta[name="twitter:title"]', title);
        setMeta('meta[name="twitter:description"]', description);
      })
      .catch((err) => {
        const status = (err as { status?: number })?.status;
        if (status === 404) {
          setError('Denne CV-en finnes ikke eller er ikke publisert.');
        } else {
          setError('Kunne ikke laste CV. Prøv igjen senere.');
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const handlePrintPdf = () => {
    const previewEl = document.querySelector('[data-public-cv-print]') as HTMLElement | null;
    if (!previewEl) return;
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) return;
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n');
    printWindow.document.open();
    printWindow.document.write(`
<!DOCTYPE html>
<html lang="${data?.resume?.language ?? 'no'}">
<head>
  <meta charset="utf-8" />
  <title>${(data?.resume?.personalInfo?.fullName ?? 'CV').replace(/</g, '&lt;')}</title>
  ${styles}
  <style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  <div>${previewEl.innerHTML}</div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 300);
      window.addEventListener('afterprint', () => window.close());
    });
  </script>
</body>
</html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Kanskje eieren har avpublisert CV-en, eller lenken er feil.
          </Typography>
          <Button variant="contained" href="https://creatorhub.no">
            Til CreatorHub
          </Button>
        </Paper>
      </Container>
    );
  }

  if (!data) return null;

  const reg = RESUME_TEMPLATES[data.resume.templateId as keyof typeof RESUME_TEMPLATES];
  const Component = reg?.component ?? ModernATSTemplate;

  // Merge sub-data inn på resume så templates får alt i ett object.
  const mergedResume = {
    ...data.resume,
    experiences: data.experiences ?? [],
    education: data.education ?? [],
    skills: data.skills ?? [],
    certifications: data.certifications ?? [],
    projects: data.projects ?? [],
    languages: data.languages ?? [],
  };

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh', py: { xs: 2, md: 5 } }}>
      <Container maxWidth="md">
        {/* Action-bar */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 2, displayPrint: 'none' }}
        >
          <Typography variant="caption" color="text.secondary">
            Offentlig CV
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PdfIcon />}
              onClick={handlePrintPdf}
            >
              Lagre som PDF
            </Button>
          </Stack>
        </Stack>

        {/* Selve CV-en */}
        <Box
          data-public-cv-print
          sx={{
            bgcolor: 'white',
            boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
            borderRadius: 1,
            overflow: 'hidden',
            mx: 'auto',
            maxWidth: '8.5in',
            '@media print': { boxShadow: 'none', borderRadius: 0 },
          }}
        >
          <Component resume={mergedResume} />
        </Box>

        {/* CreatorHub-footer (skjules ved print) */}
        <Box
          sx={{
            mt: 4,
            textAlign: 'center',
            '@media print': { display: 'none' },
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Laget med{' '}
            <MuiLink href="https://creatorhub.no" target="_blank" rel="noopener" underline="hover">
              CreatorHub ResumeBuilder <LaunchIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} />
            </MuiLink>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default PublicCV;
