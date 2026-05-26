import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  MARKETING_PAGES,
  PILLAR_COLORS,
  PILLAR_LABELS,
  isMarketingPagePublished,
  setMarketingPagePublished,
  type MarketingPageKey,
} from './marketingPagesConfig';
import MarketingPageRouter from './MarketingPageRouter';

/**
 * Admin Room-tab — Content Marketing.
 *
 * Lar produkteier (gated på email i AdminRoom-rooten):
 * - Se status per content-side knyttet til pillarene i Content Marketing-planen
 * - Slå publisert AV/PÅ uten redeploy (localStorage-override)
 * - Forhåndsvise sidene nøyaktig som de vises på theroleroom.com
 * - Åpne live-URL i ny fane
 * - Kopiere LinkedIn-utkast som matcher hver side (1-piece-to-10-outputs)
 */
export function ContentMarketingTab() {
  const [previewKey, setPreviewKey] = useState<MarketingPageKey | null>(null);
  const [publishVersion, setPublishVersion] = useState(0);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const pages = useMemo(() => {
    void publishVersion;
    return MARKETING_PAGES.map((page) => ({
      ...page,
      isPublished: isMarketingPagePublished(page.key),
    }));
  }, [publishVersion]);

  const publishedCount = pages.filter((p) => p.isPublished).length;

  function handleTogglePublish(key: MarketingPageKey, next: boolean) {
    setMarketingPagePublished(key, next);
    setPublishVersion((v) => v + 1);
    setSnackbar(next ? 'Side publisert — synlig på theroleroom.com' : 'Side avpublisert — viser 404 / fallback');
  }

  async function handleCopyDraft(draft: string) {
    try {
      await navigator.clipboard.writeText(draft);
      setSnackbar('LinkedIn-utkast kopiert til utklippstavlen');
    } catch {
      setSnackbar('Kunne ikke kopiere — kopier manuelt fra dialogen');
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
            Content marketing — pillar-sider
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.88rem' }}>
            Administrer publisering av content-sidene som driver GEO/AI-citation. Status synkes mot
            theroleroom.com på neste navigasjon — ingen redeploy nødvendig.
          </Typography>
        </Box>
        <Chip
          label={`${publishedCount} av ${pages.length} publisert`}
          size="small"
          sx={{ bgcolor: 'rgba(139,92,246,0.18)', color: '#c4b5fd', fontWeight: 700 }}
        />
      </Stack>

      <Stack spacing={2}>
        {pages.map((page) => (
          <Box
            key={page.key}
            sx={{
              p: { xs: 2, md: 2.5 },
              borderRadius: 2,
              bgcolor: 'rgba(15,23,42,0.5)',
              border: '1px solid rgba(148,163,184,0.14)',
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', rowGap: 1 }}>
                  <Chip
                    label={PILLAR_LABELS[page.pillar]}
                    size="small"
                    sx={{
                      bgcolor: `${PILLAR_COLORS[page.pillar]}22`,
                      color: PILLAR_COLORS[page.pillar],
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      letterSpacing: '0.04em',
                    }}
                  />
                  <Chip
                    label={page.isPublished ? 'Publisert' : 'Skjult'}
                    size="small"
                    sx={{
                      bgcolor: page.isPublished ? 'rgba(34,197,94,0.18)' : 'rgba(148,163,184,0.18)',
                      color: page.isPublished ? '#bbf7d0' : 'rgba(203,213,225,0.85)',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                    }}
                  />
                  <Typography
                    component="code"
                    sx={{
                      fontFamily: '"JetBrains Mono", Menlo, monospace',
                      fontSize: '0.75rem',
                      color: 'rgba(203,213,225,0.7)',
                      bgcolor: 'rgba(15,23,42,0.7)',
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 1,
                      border: '1px solid rgba(148,163,184,0.14)',
                    }}
                  >
                    {page.path}
                  </Typography>
                </Stack>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem', mb: 0.5 }}>
                  {page.title.replace(' — The Role Room', '')}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.85rem', lineHeight: 1.55 }}>
                  {page.description}
                </Typography>
              </Box>

              <Stack direction={{ xs: 'row', md: 'column' }} spacing={1} alignItems="flex-end" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Switch
                    checked={page.isPublished}
                    onChange={(_event, checked) => handleTogglePublish(page.key, checked)}
                    inputProps={{ 'aria-label': `Toggle publisering for ${page.title}` }}
                  />
                  <Typography sx={{ color: 'rgba(203,213,225,0.85)', fontSize: '0.78rem' }}>
                    {page.isPublished ? 'PÅ' : 'AV'}
                  </Typography>
                </Stack>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<VisibilityIcon />}
                  onClick={() => setPreviewKey(page.key)}
                  sx={{ textTransform: 'none', fontWeight: 700, color: '#c4b5fd', borderColor: 'rgba(167,139,250,0.5)' }}
                >
                  Forhåndsvis
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<OpenInNewIcon />}
                  href={page.path}
                  target="_blank"
                  rel="noreferrer noopener"
                  disabled={!page.isPublished}
                  sx={{ textTransform: 'none', fontWeight: 700, color: '#7dd3fc', borderColor: 'rgba(125,211,252,0.5)' }}
                >
                  Åpne live
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => handleCopyDraft(page.linkedinDraft)}
                  sx={{ textTransform: 'none', fontWeight: 700, color: '#fcd34d', borderColor: 'rgba(252,211,77,0.45)' }}
                >
                  Kopier LinkedIn-utkast
                </Button>
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>

      <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.28)' }}>
        <Typography sx={{ color: '#c7d2fe', fontWeight: 700, fontSize: '0.92rem', mb: 0.5 }}>
          Hvordan publiseringen virker
        </Typography>
        <Typography sx={{ color: 'rgba(199,210,254,0.85)', fontSize: '0.82rem', lineHeight: 1.55 }}>
          Toggling lagrer override-flagg i localStorage. Når toggle står PÅ rendres sida på public
          theroleroom.com via path-parser i casting-main. Når den står AV faller sida tilbake til
          default landing. Backend-CMS kan kobles inn senere uten å endre kall-stedene.
        </Typography>
      </Box>

      <Dialog
        open={previewKey !== null}
        onClose={() => setPreviewKey(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#0a0a0f', backgroundImage: 'none' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
            Forhåndsvisning {previewKey ? `— ${previewKey}` : ''}
          </Typography>
          <IconButton onClick={() => setPreviewKey(null)} size="small" sx={{ color: 'rgba(226,232,240,0.7)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, maxHeight: '80vh', overflow: 'auto' }}>
          {previewKey ? <MarketingPageRouter pageKey={previewKey} /> : null}
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={3500}
        onClose={() => setSnackbar(null)}
        message={snackbar ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

export default ContentMarketingTab;
