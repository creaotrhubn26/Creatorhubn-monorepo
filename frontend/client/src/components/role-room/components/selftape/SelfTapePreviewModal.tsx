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
  Alert, Box, Button, CircularProgress, Dialog, DialogContent, IconButton,
  Stack, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useEffect, useState } from 'react';

import {
  addProductionComment,
  availabilityChipStyle,
  externalProviderLabel,
  isExternalProvider,
  remindTalentToUpload,
  selftapeAvailability,
  setSelftapeDeadline,
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
  /** Trigges når en handling endrer state — parent kan re-fetche. */
  onChanged?: () => void;
}

export default function SelfTapePreviewModal({
  open, selftape, viewerLabel, onClose, onChanged,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewTracked, setViewTracked] = useState(false);
  // Produksjons-handlinger
  const [commentBody, setCommentBody] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<'remind' | 'deadline' | null>(null);
  const [actionMsg, setActionMsg] = useState<{ msg: string; tone: 'success' | 'error' } | null>(null);
  const [deadlineDraft, setDeadlineDraft] = useState('');
  // Lokal kopi av deadline_at og last_action slik at vi kan re-rendre uten å vente på parent
  const [localDeadline, setLocalDeadline] = useState<string | null>(null);

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
      setCommentBody('');
      setCommentBusy(false);
      setActionBusy(null);
      setActionMsg(null);
      setDeadlineDraft('');
      setLocalDeadline(null);
    }
  }, [open]);

  // Sync deadline-draft fra ny submission
  useEffect(() => {
    if (selftape) {
      // CastingRoleSelftape mangler deadline_at i view, men bilateral display via metadata
      const meta = selftape.submission_metadata as { deadline_at?: string | null } | null;
      setLocalDeadline(meta?.deadline_at ?? null);
      setDeadlineDraft('');
    }
  }, [selftape?.submission_id]);

  if (!selftape) return null;

  const isExternal = isExternalProvider(selftape.source_provider);
  const isRevoked = selftape.submission_status === 'revoked'
    || !!selftape.revoked_at
    || !!viewError;
  const availability = selftapeAvailability(selftape);
  const availabilityStyle = availabilityChipStyle(availability);
  const showRemind = availability === 'metadata_only' && !isRevoked;
  const isProcessing = availability === 'processing';

  const handleRemind = async () => {
    setActionBusy('remind');
    setActionMsg(null);
    try {
      await remindTalentToUpload(selftape.submission_id);
      setActionMsg({ msg: 'Påminnelse sendt til talenten', tone: 'success' });
    } catch (err) {
      setActionMsg({
        msg: err instanceof Error ? err.message : 'Påminnelse feilet',
        tone: 'error',
      });
    } finally {
      setActionBusy(null);
    }
  };

  const handleSetDeadline = async () => {
    if (!deadlineDraft.trim()) return;
    setActionBusy('deadline');
    setActionMsg(null);
    try {
      const iso = new Date(deadlineDraft).toISOString();
      await setSelftapeDeadline(selftape.submission_id, iso);
      setLocalDeadline(iso);
      setActionMsg({ msg: 'Deadline lagret', tone: 'success' });
      onChanged?.();
    } catch (err) {
      setActionMsg({
        msg: err instanceof Error ? err.message : 'Sett deadline feilet',
        tone: 'error',
      });
    } finally {
      setActionBusy(null);
    }
  };

  const handleClearDeadline = async () => {
    setActionBusy('deadline');
    setActionMsg(null);
    try {
      await setSelftapeDeadline(selftape.submission_id, null);
      setLocalDeadline(null);
      setDeadlineDraft('');
      setActionMsg({ msg: 'Deadline fjernet', tone: 'success' });
      onChanged?.();
    } catch (err) {
      setActionMsg({
        msg: err instanceof Error ? err.message : 'Fjern deadline feilet',
        tone: 'error',
      });
    } finally {
      setActionBusy(null);
    }
  };

  const handleComment = async () => {
    const body = commentBody.trim();
    if (!body) return;
    setCommentBusy(true);
    setActionMsg(null);
    try {
      await addProductionComment(selftape.submission_id, body);
      setCommentBody('');
      setActionMsg({ msg: 'Kommentar sendt — talent er varslet', tone: 'success' });
      onChanged?.();
    } catch (err) {
      setActionMsg({
        msg: err instanceof Error ? err.message : 'Kommentar feilet',
        tone: 'error',
      });
    } finally {
      setCommentBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          bgcolor: palette.bgShell,
          color: palette.textPrimary,
          border: isMobile ? 'none' : `1px solid ${palette.border}`,
          borderRadius: isMobile ? 0 : 2.4,
          // Safe-area-inset for iPhone notch
          ...(isMobile && {
            paddingTop: 'env(safe-area-inset-top, 0)',
            paddingBottom: 'env(safe-area-inset-bottom, 0)',
          }),
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
            {/* Tilstand-chip: Video tilgjengelig / Behandles / Sendt uten video */}
            {!isRevoked ? (
              <Box
                sx={{
                  bgcolor: availabilityStyle.bg,
                  color: availabilityStyle.fg,
                  fontWeight: 700, fontSize: '0.72rem',
                  px: 1, py: 0.3, borderRadius: 999,
                  border: `1px solid ${availabilityStyle.border}`,
                }}
              >
                {availabilityStyle.label}
              </Box>
            ) : null}
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

          {/* Produksjons-handlinger */}
          {!isRevoked ? (
            <Box sx={{ pt: 1.6, borderTop: `1px solid ${palette.borderSubtle}` }}>
              {actionMsg ? (
                <Alert severity={actionMsg.tone} sx={{ mb: 1.4 }} onClose={() => setActionMsg(null)}>
                  {actionMsg.msg}
                </Alert>
              ) : null}

              {/* Deadline-rad */}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ sm: 'center' }}
                spacing={1}
                sx={{ mb: 1.4 }}
              >
                <Stack direction="row" alignItems="center" spacing={0.6} sx={{ minWidth: 130 }}>
                  <EventOutlinedIcon sx={{ fontSize: 16, color: palette.textMuted }} />
                  <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Frist
                  </Typography>
                </Stack>
                {localDeadline && !deadlineDraft ? (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {new Date(localDeadline).toLocaleString('nb-NO', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => setDeadlineDraft(localDeadline.slice(0, 16))}
                      sx={{ color: palette.accentBright, textTransform: 'none', fontSize: '0.78rem' }}
                    >
                      Endre
                    </Button>
                    <Button
                      size="small"
                      onClick={handleClearDeadline}
                      disabled={actionBusy === 'deadline'}
                      sx={{ color: '#f87171', textTransform: 'none', fontSize: '0.78rem' }}
                    >
                      Fjern
                    </Button>
                  </Stack>
                ) : (
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
                    <TextField
                      type="datetime-local"
                      size="small"
                      value={deadlineDraft}
                      onChange={(e) => setDeadlineDraft(e.target.value)}
                      sx={{
                        '& .MuiInputBase-input': { color: palette.textPrimary, py: 0.6, fontSize: '0.85rem' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(168,85,247,0.32)' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: palette.accentBright },
                        // datetime-input ikon-fix for mørkt tema
                        '& input::-webkit-calendar-picker-indicator': { filter: 'invert(0.9)' },
                      }}
                    />
                    <Button
                      size="small"
                      onClick={handleSetDeadline}
                      disabled={!deadlineDraft || actionBusy === 'deadline'}
                      sx={{
                        background: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
                        color: '#fff',
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        px: 1.4,
                        '&.Mui-disabled': { background: 'rgba(168,85,247,0.32)', color: 'rgba(255,255,255,0.5)' },
                      }}
                    >
                      {actionBusy === 'deadline' ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : 'Lagre'}
                    </Button>
                    {deadlineDraft && localDeadline ? (
                      <Button
                        size="small"
                        onClick={() => setDeadlineDraft('')}
                        sx={{ color: palette.textMuted, textTransform: 'none', fontSize: '0.78rem' }}
                      >
                        Avbryt
                      </Button>
                    ) : null}
                  </Stack>
                )}
              </Stack>

              {/* Remind-knapp (kun når submission har metadata uten video) */}
              {showRemind ? (
                <Box
                  sx={{
                    bgcolor: 'rgba(251,191,36,0.10)',
                    border: `1px solid rgba(251,191,36,0.32)`,
                    borderRadius: 1,
                    p: 1.4,
                    mb: 1.4,
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Typography sx={{ color: '#fbbf24', fontSize: '0.82rem', flex: 1 }}>
                      Talent har sendt submission, men ikke lastet opp video ennå.
                      Send en vennlig påminnelse?
                    </Typography>
                    <Button
                      size="small"
                      onClick={handleRemind}
                      disabled={actionBusy === 'remind'}
                      startIcon={actionBusy === 'remind'
                        ? <CircularProgress size={12} sx={{ color: '#fbbf24' }} />
                        : <NotificationsActiveOutlinedIcon sx={{ fontSize: 14 }} />}
                      sx={{
                        bgcolor: 'rgba(251,191,36,0.22)',
                        color: '#fbbf24',
                        border: '1px solid rgba(251,191,36,0.45)',
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        '&:hover': { bgcolor: 'rgba(251,191,36,0.32)' },
                      }}
                    >
                      Påminn
                    </Button>
                  </Stack>
                </Box>
              ) : isProcessing ? (
                <Box
                  sx={{
                    bgcolor: 'rgba(251,191,36,0.10)',
                    border: `1px solid rgba(251,191,36,0.32)`,
                    borderRadius: 1,
                    p: 1.4,
                    mb: 1.4,
                  }}
                >
                  <Typography sx={{ color: '#fbbf24', fontSize: '0.82rem' }}>
                    Cloudflare transkoder videoen. Den blir spillbar om 1-2 minutter.
                  </Typography>
                </Box>
              ) : null}

              {/* Kommentar-felt */}
              <Box>
                <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.8 }}>
                  <ChatBubbleOutlineIcon sx={{ fontSize: 16, color: palette.textMuted }} />
                  <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Skriv kommentar til talent
                  </Typography>
                </Stack>
                <TextField
                  multiline
                  minRows={2}
                  maxRows={6}
                  fullWidth
                  placeholder="F.eks. 'Veldig god lyd, men prøv et tighter utsnitt på neste take.'"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  inputProps={{ maxLength: 2000 }}
                  sx={{
                    '& .MuiInputBase-input': { color: palette.textPrimary, fontSize: '0.88rem' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(168,85,247,0.24)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: palette.accentBright },
                  }}
                />
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.8 }}>
                  <Typography sx={{ color: palette.textMuted, fontSize: '0.72rem' }}>
                    Talent får e-post med kommentaren.
                  </Typography>
                  <Button
                    onClick={handleComment}
                    disabled={!commentBody.trim() || commentBusy}
                    startIcon={commentBusy
                      ? <CircularProgress size={14} sx={{ color: '#fff' }} />
                      : <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      background: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
                      color: '#fff',
                      textTransform: 'none',
                      fontWeight: 700,
                      px: 2,
                      '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                      '&.Mui-disabled': { background: 'rgba(168,85,247,0.32)', color: 'rgba(255,255,255,0.6)' },
                    }}
                  >
                    Send kommentar
                  </Button>
                </Stack>
              </Box>
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
