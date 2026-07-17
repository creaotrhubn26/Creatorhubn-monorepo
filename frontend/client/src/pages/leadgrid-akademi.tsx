/**
 * leadgrid-akademi.tsx
 *
 * Hub-siden for Leadgrid Akademi (/akademi på leadgrid.no) — et rent
 * redaksjonelt læringstilbud om B2B-salg, leadgenerering og feltsalg
 * (docs/integration-audit/13). Lister artiklene fra akademiConfig.
 * Offentlig side — krever ikke auth. Ingen produktreklame utover
 * ærlig avsender-merking.
 */

import { Box, Chip, Container, Stack, Typography } from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import { AKADEMI_ARTICLES } from '../components/leadgrid/akademiConfig';

const PUBLISHED = AKADEMI_ARTICLES.filter((a) => a.published);

export function LeadgridAkademiPage() {
  return (
    <Box
      component="main"
      sx={{
        width: '100%',
        minHeight: '100vh',
        bgcolor: '#0a0512',
        color: '#e2e8f0',
        py: { xs: 5, md: 8 },
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Leadgrid Akademi',
            description:
              'Redaksjonelt læringstilbud om B2B-salg, leadgenerering og feltsalg for norske bedrifter.',
            inLanguage: 'no',
            publisher: { '@type': 'Organization', name: 'Leadgrid (Creatorhub AS)' },
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: PUBLISHED.map((a, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `https://leadgrid.no${a.path}`,
                name: a.title,
              })),
            },
          }),
        }}
      />

      <Container maxWidth="md">
        <Stack spacing={2.5} sx={{ mb: 5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <SchoolIcon sx={{ color: '#9be15d' }} />
            <Typography
              sx={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: { xs: '0.84rem', md: '0.92rem' },
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#9be15d',
                fontWeight: 700,
              }}
            >
              Leadgrid Akademi
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Lær håndverket bak B2B-salg og leadgenerering
          </Typography>
          <Typography sx={{ fontSize: { xs: '1.02rem', md: '1.12rem' }, color: '#cbd5e1', lineHeight: 1.7 }}>
            Akademiet er Leadgrids redaksjonelle læringstilbud: praktiske guider og
            artikler om hvordan norske bedrifter faktisk skaffer, følger opp og vinner
            kunder. Alt innhold er faktabasert med navngitte kilder — og fritt
            tilgjengelig, uten innlogging. Vi bygger akademiet videre sammen med
            etablerte fagstemmer i norsk B2B-salg.
          </Typography>
        </Stack>

        <Stack spacing={2.5}>
          {PUBLISHED.map((article) => (
            <Box
              key={article.key}
              component="a"
              href={article.path}
              sx={{
                display: 'block',
                textDecoration: 'none',
                border: '1px solid rgba(155,225,93,0.25)',
                borderRadius: 2,
                p: { xs: 2.5, md: 3 },
                transition: 'border-color 120ms ease',
                '&:hover': { borderColor: '#9be15d' },
              }}
            >
              <Stack spacing={1}>
                <Chip
                  label={article.category}
                  size="small"
                  sx={{
                    alignSelf: 'flex-start',
                    bgcolor: 'rgba(155,225,93,0.12)',
                    color: '#9be15d',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                  }}
                />
                <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.15rem', md: '1.3rem' }, lineHeight: 1.3 }}>
                  {article.title.replace(/ \| Leadgrid Akademi$/, '')}
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  {article.description}
                </Typography>
              </Stack>
            </Box>
          ))}
        </Stack>

        <Box sx={{ mt: 6, pt: 3, borderTop: '1px solid rgba(148,163,184,0.2)' }}>
          <Typography sx={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Leadgrid Akademi utgis av Creatorhub AS. Artiklene er redaksjonelle:
            der Leadgrid som produkt nevnes, er det merket tydelig, og alle tall
            har navngitt kilde.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default LeadgridAkademiPage;
