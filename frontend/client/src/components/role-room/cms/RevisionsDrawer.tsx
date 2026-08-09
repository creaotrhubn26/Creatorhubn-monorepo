/**
 * RevisionsDrawer.tsx
 *
 * Side-drawer i AdminRoom CMS-editor som lister historiske
 * revisjoner og lar produkt-eier revert til en tidligere versjon.
 *
 * Backend-endpoints brukes:
 *   GET    /api/admin/cms/pages/:slug/revisions
 *   POST   /api/admin/cms/pages/:slug/revert/:revisionId
 *
 * Diff-visning i denne fasen: enkel side-by-side preview-pane med
 * "current vs valgt". Full unified-diff kommer senere.
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import RestoreIcon from '@mui/icons-material/Restore';
import BlockRenderer from './BlockRenderer';
import { isBlockArray, type Block } from './blockSchema';
import { useT } from '../../../i18n';

interface Revision {
  id: number;
  slug: string;
  content: Record<string, unknown>;
  variant: string;
  published: boolean;
  created_at: string;
  created_by?: string;
}

interface RevisionsDrawerProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  onRevert: () => void;
}

export default function RevisionsDrawer({ open, onClose, slug, onRevert }: RevisionsDrawerProps) {
  const { t } = useT();
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reverting, setReverting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setFeedback(null);
    fetch(`/api/admin/cms/pages/${slug}/revisions`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : { revisions: [] }))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.revisions) ? (data.revisions as Revision[]) : [];
        setRevisions(list);
        setSelectedId(list[0]?.id ?? null);
      })
      .catch(() => { if (!cancelled) setRevisions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, open]);

  const selected = revisions.find((r) => r.id === selectedId);

  const handleRevert = async () => {
    if (!selected) return;
    if (!confirm(t('cmsRev.confirmRevert', { date: formatDate(selected.created_at) }))) {
      return;
    }
    setReverting(true);
    setFeedback(null);
    setFeedbackError(false);
    try {
      const res = await fetch(`/api/admin/cms/pages/${slug}/revert/${selected.id}`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFeedback(t('cmsRev.revertSuccess'));
      onRevert();
    } catch (err) {
      setFeedback(t('cmsRev.revertError', { message: (err as Error).message ?? '' }));
      setFeedbackError(true);
    } finally {
      setReverting(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', md: 720 },
          bgcolor: '#0b1120',
          color: '#e2e8f0',
        },
      }}
    >
      <Stack sx={{ height: '100%' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(148,163,184,0.16)' }}>
          <HistoryIcon sx={{ color: '#a78bfa' }} />
          <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1rem', flex: 1 }}>
            {t('cmsRev.title', { slug })}
          </Typography>
          <IconButton size="small" onClick={onClose} aria-label={t('cmsRev.close')} sx={{ color: 'rgba(203,213,225,0.78)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ flex: 1 }}>
            <CircularProgress />
          </Stack>
        ) : revisions.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, p: 4 }}>
            <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.9rem' }}>
              {t('cmsRev.empty')}
            </Typography>
          </Stack>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '240px 1fr' }, flex: 1, minHeight: 0 }}>
            {/* Revisjons-liste */}
            <Stack spacing={0.6} sx={{ p: 1.5, borderRight: { md: '1px solid rgba(148,163,184,0.16)' }, overflowY: 'auto' }}>
              {revisions.map((r, i) => {
                const isSelected = r.id === selectedId;
                return (
                  <Box
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(r.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    sx={{
                      p: 1.2,
                      borderRadius: 1,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(148,163,184,0.14)',
                      bgcolor: isSelected ? 'rgba(167,139,250,0.10)' : 'rgba(2,6,23,0.34)',
                      '&:hover': { bgcolor: 'rgba(167,139,250,0.06)' },
                      '&:focus-visible': { outline: '2px solid #a78bfa', outlineOffset: -2 },
                    }}
                  >
                    <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.4 }}>
                      <Chip
                        size="small"
                        label={i === 0 ? t('cmsRev.latest') : `#${revisions.length - i}`}
                        sx={{
                          bgcolor: i === 0 ? 'rgba(34,197,94,0.16)' : 'rgba(148,163,184,0.16)',
                          color: i === 0 ? '#86efac' : '#cbd5e1',
                          fontWeight: 700,
                          height: 20,
                          fontSize: '0.7rem',
                        }}
                      />
                      {r.published ? (
                        <Chip size="small" label="live" sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: '#86efac', height: 20, fontSize: '0.66rem' }} />
                      ) : (
                        <Chip size="small" label={t('cmsRev.draft')} sx={{ bgcolor: 'rgba(249,115,22,0.12)', color: '#fdba74', height: 20, fontSize: '0.66rem' }} />
                      )}
                    </Stack>
                    <Typography sx={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: 600 }}>
                      {formatDate(r.created_at)}
                    </Typography>
                    {r.created_by ? (
                      <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.72rem' }}>
                        {r.created_by}
                      </Typography>
                    ) : null}
                  </Box>
                );
              })}
            </Stack>

            {/* Innhold-preview */}
            <Stack sx={{ minHeight: 0, overflow: 'hidden' }}>
              {selected ? (
                <>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ p: 1.5, borderBottom: '1px solid rgba(148,163,184,0.16)' }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {t('cmsRev.selectedRevision')}
                      </Typography>
                      <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.92rem' }}>
                        {formatDate(selected.created_at)}{selected.created_by ? ` · ${selected.created_by}` : ''}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<RestoreIcon />}
                      onClick={handleRevert}
                      disabled={reverting}
                      sx={{
                        bgcolor: '#a78bfa',
                        color: '#0b1120',
                        textTransform: 'none',
                        fontWeight: 700,
                        '&:hover': { bgcolor: '#c4b5fd' },
                      }}
                    >
                      {reverting ? t('cmsRev.rollingBack') : t('cmsRev.revertToThis')}
                    </Button>
                  </Stack>
                  {feedback ? (
                    <Alert
                      severity={feedbackError ? 'error' : 'success'}
                      sx={{
                        m: 1.5,
                        bgcolor: feedbackError ? 'rgba(239,68,68,0.10)' : 'rgba(34,197,94,0.10)',
                        color: feedbackError ? '#fca5a5' : '#86efac',
                      }}
                    >
                      {feedback}
                    </Alert>
                  ) : null}
                  <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
                    <RevisionContentPreview content={selected.content} />
                  </Box>
                </>
              ) : (
                <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, p: 4 }}>
                  <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.9rem' }}>
                    {t('cmsRev.selectPrompt')}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Box>
        )}
      </Stack>
    </Drawer>
  );
}

function RevisionContentPreview({ content }: { content: Record<string, unknown> }) {
  const blocks = isBlockArray(content.blocks) ? (content.blocks as Block[]) : null;
  if (blocks) {
    return <BlockRenderer blocks={blocks} />;
  }
  return (
    <Box
      component="pre"
      sx={{
        bgcolor: 'rgba(2,6,23,0.5)',
        color: 'rgba(203,213,225,0.86)',
        fontSize: '0.78rem',
        p: 1.5,
        borderRadius: 1,
        overflow: 'auto',
        m: 0,
      }}
    >
      {JSON.stringify(content, null, 2)}
    </Box>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
