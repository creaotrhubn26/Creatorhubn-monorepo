/**
 * ReviewModerationPanel.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Eier-moderering av klient-omtaler (#5). Viser alle omtaler (inkl. ventende)
 * med publiser/skjul + fotograf-svar. Bruker:
 *   GET   /api/photographer/reviews
 *   PATCH /api/photographer/reviews/:id   { status?, reply? }
 *
 * Vises kun i eier-visning.
 */

import React from 'react';
import {
  Box, Typography, Stack, Button, Chip, Rating, TextField, CircularProgress, Collapse,
} from '@mui/material';
import {
  CheckCircle, VisibilityOff, ReplyOutlined, ExpandMore,
} from '@mui/icons-material';

const TEXT = '#F5F2EA';
const MUTED = 'rgba(245,242,234,0.6)';
const AMBER = '#ffba6c';
const SUCCESS = '#5fb88a';
const WARN = '#e0a955';

const fieldSx = {
  '& .MuiInputBase-input, & .MuiInputBase-inputMultiline': { color: TEXT },
  '& .MuiInputLabel-root': { color: MUTED },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.18)' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.32)' },
};

interface OwnerReview {
  id: string;
  author: string;
  role?: string;
  text: string;
  rating: number;
  status: string; // pending | published | hidden
  reply?: string | null;
  verified?: boolean;
  createdAt?: string;
}

interface Props {
  /** Kalles etter at en omtale endrer status — lar footeren re-laste publiserte. */
  onChanged?: () => void;
}

export default function ReviewModerationPanel({ onChanged }: Props) {
  const [reviews, setReviews] = React.useState<OwnerReview[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [replyDraft, setReplyDraft] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/photographer/reviews', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.reviews)) setReviews(json.reviews);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const patch = React.useCallback(async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/photographer/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) { await load(); onChanged?.(); }
    } catch { /* ignore */ } finally { setBusyId(null); }
  }, [load, onChanged]);

  const pendingCount = reviews.filter((r) => r.status === 'pending').length;

  const statusChip = (status: string) => {
    if (status === 'published') return <Chip size="small" label="Publisert" sx={{ bgcolor: 'rgba(95,184,138,0.16)', color: SUCCESS, height: 20 }} />;
    if (status === 'hidden') return <Chip size="small" label="Skjult" sx={{ bgcolor: 'rgba(245,242,234,0.08)', color: MUTED, height: 20 }} />;
    return <Chip size="small" label="Venter" sx={{ bgcolor: 'rgba(224,169,85,0.16)', color: WARN, height: 20 }} />;
  };

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', mt: 6, p: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between"
        sx={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={{ fontWeight: 700, color: TEXT }}>Moderer omtaler</Typography>
          {pendingCount > 0 && (
            <Chip size="small" label={`${pendingCount} venter`} sx={{ bgcolor: 'rgba(224,169,85,0.16)', color: WARN, height: 20 }} />
          )}
        </Stack>
        <ExpandMore sx={{ color: MUTED, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </Stack>

      <Collapse in={open}>
        <Box sx={{ mt: 2 }}>
          {loading ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: MUTED }}>
              <CircularProgress size={16} sx={{ color: AMBER }} /><Typography sx={{ fontSize: '0.85rem' }}>Laster…</Typography>
            </Stack>
          ) : reviews.length === 0 ? (
            <Typography sx={{ color: MUTED, fontSize: '0.85rem' }}>Ingen omtaler ennå.</Typography>
          ) : (
            <Stack spacing={1.5}>
              {reviews.map((r) => (
                <Box key={r.id} sx={{ p: 2, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography sx={{ fontWeight: 700, color: TEXT, fontSize: '0.9rem' }}>{r.author}</Typography>
                        {r.verified && <CheckCircle sx={{ fontSize: 14, color: SUCCESS }} />}
                        {statusChip(r.status)}
                      </Stack>
                      <Rating value={r.rating} readOnly size="small" sx={{ '& .MuiRating-iconFilled': { color: AMBER } }} />
                      <Typography sx={{ color: 'rgba(245,242,234,0.85)', fontSize: '0.85rem', mt: 0.5 }}>"{r.text}"</Typography>
                      {r.reply && (
                        <Typography sx={{ color: MUTED, fontSize: '0.8rem', mt: 1, pl: 1.5, borderLeft: `2px solid ${AMBER}` }}>
                          Ditt svar: {r.reply}
                        </Typography>
                      )}
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                    {r.status !== 'published' && (
                      <Button size="small" startIcon={<CheckCircle />} disabled={busyId === r.id}
                        onClick={() => patch(r.id, { status: 'published' })}
                        sx={{ color: SUCCESS, textTransform: 'none' }}>Publiser</Button>
                    )}
                    {r.status !== 'hidden' && (
                      <Button size="small" startIcon={<VisibilityOff />} disabled={busyId === r.id}
                        onClick={() => patch(r.id, { status: 'hidden' })}
                        sx={{ color: MUTED, textTransform: 'none' }}>Skjul</Button>
                    )}
                  </Stack>

                  <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="flex-start">
                    <TextField fullWidth size="small" multiline label="Svar på omtalen (valgfritt)"
                      value={replyDraft[r.id] ?? r.reply ?? ''} sx={fieldSx}
                      onChange={(e) => setReplyDraft((p) => ({ ...p, [r.id]: e.target.value }))} />
                    <Button size="small" startIcon={<ReplyOutlined />} disabled={busyId === r.id}
                      onClick={() => patch(r.id, { reply: replyDraft[r.id] ?? '' })}
                      sx={{ color: AMBER, textTransform: 'none', whiteSpace: 'nowrap', mt: 0.5 }}>Lagre svar</Button>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
