/**
 * SelfTapePreviewModal — produksjon-side preview av talents self-tape.
 *
 * Brukes fra KanbanPanel når et kort med talent_id har aktive
 * submissions for rollen. Viser video + AI-feedback-sammendrag +
 * watermark + audit-trail.
 *
 * GDPR:
 *  - Logger 'viewed'-event på første åpning per session
 *  - Viser tydelig hvem-så-når i header
 *  - For eksterne kilder: iframe + advarsel om at vi ikke kan watermarke
 *  - Hvis submission er revoked, vises 410-error i stedet for video
 */
import {
  Box, Dialog, DialogContent, IconButton, Stack, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useEffect, useState } from 'react';

import {
  externalProviderLabel,
  isExternalProvider,
  trackSelftapeView,
  type CastingRoleSelftape,
} from '../../services/roleRoomSelfTapesService';

// Tema-konstanter — duplisert lokalt så denne komponenten kan brukes
// utenfor talents-app uten å trekke inn dens theme.
const palette = {
  bgShell: '#0f0721',
  bgCard: '#150b2e',
  border: 'rgba(168, 85, 247, 0.18)',
  borderSubtle: 'rgba(168, 85, 247, 0.08)',
  textPrimary: '#f5f3ff',
  textMuted: '#8b7ec4',
  accentBright: '#c084fc',
};

interface Props {
  open: boolean;
  selftape: CastingRoleSelftape | null;
  viewerLabel?: string;       // f.eks. "Anna Hansen (Stella Casting)"
  onClose: () => void;
}

export default function SelfTapePreviewModal({
  open, selftape, viewerLabel, onClose,
}: Props) {
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewTracked, setViewTracked] = useState(false);

  useEffect(() => {
    if (!open || !selftape || viewTracked) return;
    // Best-effort tracking — feiler aldri silently for UI
    trackSelftapeView(selftape.submission_id)
      .then(() => setViewTracked(true))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'View-tracking feilet';
        if (msg.toLowerCase().includes('revoket')) {
          setViewError('Talent har trukket tilbake denne self-tapen');
        }
      });
  }, [open, selftape, viewTracked]);

  // Reset state når modal lukkes
  useEffect(() => {
    if (!open) {
      setViewError(null);
      setViewTracked(false);
    }
  }, [open]);

  if (!selftape) return null;

  const isExternal = isExternalProvider(selftape.source_provider);
  const isRevoked = selftape.submission_status === 'revoked'
    || !!selftape.revoked_at
    || !!viewError;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          bgcolor: palette.bgShell,
          color: palette.textPrimary,
          border: `1px solid ${palette.border}`,
          borderRadius: 2.4,
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ p: 2, borderBottom: `1px solid ${palette.borderSubtle}` }}
        >
          <Stack direction="row" alignItems="center" spacing={1.4}>
            {selftape.talent_headshot_url ? (
              <Box
                sx={{
                  width: 40, height: 40, borderRadius: '50%',
                  backgroundImage: `url(${selftape.talent_headshot_url})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  flexShrink: 0,
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 40, height: 40, borderRadius: '50%',
                  bgcolor: 'rgba(168,85,247,0.18)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: palette.accentBright, fontWeight: 800, flexShrink: 0,
                }}
              >
                {(selftape.talent_display_name ?? '?')[0]}
              </Box>
            )}
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
                {selftape.talent_display_name ?? 'Ukjent talent'}
              </Typography>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                Take {selftape.take_number ?? '—'} · {selftape.selftape_project_name}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.4}
              sx={{
                bgcolor: 'rgba(192,132,252,0.16)',
                color: palette.accentBright,
                fontWeight: 700, fontSize: '0.72rem',
                px: 1, py: 0.3, borderRadius: 999,
              }}
            >
              <VisibilityOutlinedIcon sx={{ fontSize: 12 }} />
              {selftape.view_count} {selftape.view_count === 1 ? 'visning' : 'visninger'}
            </Stack>
            <IconButton onClick={onClose} sx={{ color: palette.textMuted }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>

        {/* Video / iframe */}
        <Box
          sx={{
            position: 'relative',
            aspectRatio: '16 / 9',
            bgcolor: '#000',
          }}
        >
          {isRevoked ? (
            <Box
              sx={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                p: 4, textAlign: 'center',
              }}
            >
              <Box>
                <Typography sx={{ color: '#f87171', fontWeight: 700, fontSize: '1.1rem', mb: 1 }}>
                  Tilgangen er trukket tilbake
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.86rem' }}>
                  Talent har revokert denne self-tapen. Kontakt byrået for ny tilgang.
                </Typography>
              </Box>
            </Box>
          ) : isExternal && selftape.video_url ? (
            <iframe
              src={selftape.video_url}
              title={`Take ${selftape.take_number ?? ''}`}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              style={{ width: '100%', height: '100%', border: 0 }}
            />
          ) : selftape.video_url ? (
            <video
              src={selftape.video_url}
              controls
              playsInline
              poster={selftape.thumbnail_url ?? undefined}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <Box
              sx={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              Video ikke tilgjengelig
            </Box>
          )}

          {/* Watermark — kun for CF Stream (signed URL) */}
          {!isExternal && !isRevoked && viewerLabel ? (
            <Box
              sx={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                bgcolor: 'rgba(0,0,0,0.55)',
                color: 'rgba(255,255,255,0.85)',
                fontSize: '0.7rem',
                fontWeight: 600,
                px: 1.2,
                py: 0.4,
                borderRadius: 0.6,
                pointerEvents: 'none',
                fontFamily: 'monospace',
              }}
            >
              {viewerLabel} · {new Date().toLocaleDateString('nb-NO')}
            </Box>
          ) : null}
        </Box>

        {/* Footer-info */}
        <Stack spacing={1.6} sx={{ p: 2.4 }}>
          {isExternal ? (
            <Box
              sx={{
                bgcolor: 'rgba(251,191,36,0.10)',
                color: '#fcd34d',
                border: `1px solid rgba(251,191,36,0.32)`,
                p: 1.4,
                borderRadius: 1,
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '0.84rem', mb: 0.4 }}>
                Eksternt hostet ({externalProviderLabel(selftape.source_provider)})
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', opacity: 0.92 }}>
                Vi kan ikke watermarke eller view-audit denne videoen.
                Talenten styrer fortsatt tilgangen via plattformen.
              </Typography>
            </Box>
          ) : (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ color: '#34d399' }}>
              <VerifiedOutlinedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }}>
                Signed URL · 3 timer gyldighet · audit-logget
              </Typography>
            </Stack>
          )}

          {/* AI-feedback hint */}
          {selftape.ai_feedback_id && !isExternal ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <AutoAwesomeOutlinedIcon sx={{ color: palette.accentBright, fontSize: 16 }} />
              <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                Claude Opus 4.7 har vurdert denne taken
              </Typography>
            </Stack>
          ) : null}

          {/* Submission-meta */}
          <Stack direction="row" justifyContent="space-between" sx={{ pt: 1.4, borderTop: `1px solid ${palette.borderSubtle}` }}>
            <Box>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Sendt
              </Typography>
              <Typography sx={{ fontSize: '0.86rem', fontWeight: 600 }}>
                {selftape.submitted_at
                  ? new Date(selftape.submitted_at).toLocaleDateString('nb-NO', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })
                  : '—'}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Sist sett
              </Typography>
              <Typography sx={{ fontSize: '0.86rem', fontWeight: 600 }}>
                {selftape.last_viewed_at
                  ? new Date(selftape.last_viewed_at).toLocaleString('nb-NO', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })
                  : '—'}
              </Typography>
            </Box>
            {isExternal && selftape.external_url ? (
              <Box
                component="a"
                href={selftape.external_url}
                target="_blank"
                rel="noreferrer"
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.4,
                  color: palette.accentBright,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                <OpenInNewIcon sx={{ fontSize: 14 }} />
                Original
              </Box>
            ) : null}
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
