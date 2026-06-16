/**
 * NurtureSequenceDialog — Agent «Nurture-sekvens» per lead.
 * Porter nur-2-designet: 4-stegs sekvens (Velkomst→Verdi→Case→Tilbud),
 * lead-header med varmhet, generert e-post per steg (emne + tekst + ekte
 * innsikt) og planlagt sendetidspunkt. Innholdet er Claude-generert og
 * kontekstuelt (segment + ekte beste-tid-innsikt). Sending kobles på senere.
 *
 * Backend: /api/role-room/leads/nurture (mig 286).
 */

import * as React from 'react';
import {
  Dialog, DialogContent, Box, Stack, Typography, Button, Chip, IconButton, CircularProgress,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DraftsIcon from '@mui/icons-material/Drafts';
import InsightsIcon from '@mui/icons-material/Insights';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import roleRoomAgentService, { type RoleRoomLeadNurtureSequence } from '../../services/roleRoomAgentService';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

export interface NurtureLead {
  id: string;
  name: string | null;
  email: string | null;
  segment: string | null;
}

export interface NurtureSequenceDialogProps {
  open: boolean;
  onClose: () => void;
  lead: NurtureLead;
  connectionId?: string | null;
  company?: string | null;
}

const SEGMENT_META: Record<string, { label: string; color: string; bg: string }> = {
  varm: { label: 'Engasjert', color: '#34d399', bg: 'rgba(52,211,153,0.16)' },
  lunken: { label: 'Lunken', color: '#fbbf24', bg: 'rgba(251,191,36,0.16)' },
  kald: { label: 'Kald', color: '#60a5fa', bg: 'rgba(96,165,250,0.16)' },
  tapt: { label: 'Tapt', color: 'rgba(226,232,240,0.6)', bg: 'rgba(148,163,184,0.16)' },
};

function initials(name: string | null): string {
  if (!name) return 'RR';
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || 'RR';
}

export default function NurtureSequenceDialog({ open, onClose, lead, connectionId, company }: NurtureSequenceDialogProps): React.ReactElement {
  const [sequence, setSequence] = React.useState<RoleRoomLeadNurtureSequence | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [activeStep, setActiveStep] = React.useState(2); // Verdi-trinnet er fokus i designet

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void roleRoomAgentService.getNurtureSequence(lead.id)
      .then((s) => { if (!cancelled) { setSequence(s); if (s?.steps?.length) setActiveStep(Math.min(2, s.steps.length)); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, lead.id]);

  const generate = async (): Promise<void> => {
    setGenerating(true);
    try {
      const created = await roleRoomAgentService.generateNurtureSequence({
        connectionId, leadExternalId: lead.id, leadName: lead.name || 'der',
        leadEmail: lead.email, segment: lead.segment, company: company ?? null,
      });
      if (created) { setSequence(created); setActiveStep(Math.min(2, created.steps.length)); }
    } finally { setGenerating(false); }
  };

  const queue = async (): Promise<void> => {
    if (!sequence) return;
    setBusy(true);
    const ok = await roleRoomAgentService.patchNurtureSequence(sequence.id, 'queued');
    setBusy(false);
    if (ok) setSequence({ ...sequence, status: 'queued' });
  };

  const seg = lead.segment ? SEGMENT_META[lead.segment] : null;
  const steps = sequence?.steps ?? [];
  const current = steps.find((s) => s.step === activeStep) ?? steps[0] ?? null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)', border: '1px solid rgba(167,139,250,0.2)' } }}>
      <DialogContent sx={{ p: { xs: 2, md: 2.8 } }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.6 }}>
          <Stack direction="row" alignItems="center" spacing={1.1}>
            <Box sx={{ width: 30, height: 30, borderRadius: 1.4, display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 6px 16px rgba(168,85,247,0.45)' }}>
              <AutoAwesomeIcon sx={{ fontSize: 17, color: '#fff' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.5px', background: 'linear-gradient(135deg, #c4b5fd, #f0abfc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>
                The Role Room Agent
              </Typography>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: INK }}>Nurture-sekvens</Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(226,232,240,0.5)' }}><CloseIcon fontSize="small" /></IconButton>
        </Stack>

        {loading ? (
          <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} sx={{ color: ACCENT }} /></Box>
        ) : !sequence ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <DraftsIcon sx={{ fontSize: 38, color: ACCENT, mb: 1 }} />
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: INK, mb: 0.5 }}>Ingen sekvens ennå</Typography>
            <Typography sx={{ fontSize: 13, color: MUTED, mb: 2, maxWidth: 360, mx: 'auto' }}>
              Agenten lager en kontekstuell 4-stegs nurture-sekvens for {lead.name || 'denne leaden'} — tilpasset segment og med ekte beste-tid-innsikt.
            </Typography>
            <Button onClick={() => void generate()} disabled={generating} variant="contained" disableElevation
              startIcon={generating ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <AutoAwesomeIcon />}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, background: GRAD, color: '#fff', '&:hover': { background: GRAD, filter: 'brightness(1.06)' } }}>
              Generer sekvens
            </Button>
          </Box>
        ) : (
          <Stack spacing={1.8}>
            {/* Sekvens-progresjon */}
            <Stack direction="row" spacing={0.6} alignItems="center">
              {steps.map((s) => {
                const active = s.step === activeStep;
                const done = s.step < activeStep;
                return (
                  <Box key={s.step} onClick={() => setActiveStep(s.step)}
                    sx={{ flex: 1, cursor: 'pointer', p: 0.8, borderRadius: 1.6, textAlign: 'center',
                      border: active ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(148,163,184,0.14)',
                      bgcolor: active ? 'rgba(168,85,247,0.14)' : 'rgba(15,23,42,0.4)' }}>
                    <Box sx={{ width: 20, height: 20, mx: 'auto', mb: 0.4, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800,
                      background: done || active ? GRAD : 'rgba(148,163,184,0.2)', color: '#fff' }}>
                      {done ? <CheckRoundedIcon sx={{ fontSize: 13 }} /> : s.step}
                    </Box>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: active ? '#e9d5ff' : MUTED }}>{s.label}</Typography>
                  </Box>
                );
              })}
            </Stack>

            {/* Lead-header */}
            <Stack direction="row" alignItems="center" spacing={1.2} sx={{ p: 1.2, borderRadius: 2.2, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.14)' }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: GRAD, color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                {initials(lead.name)}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name || 'Ukjent lead'}</Typography>
                <Typography sx={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email || '—'}</Typography>
              </Box>
              {seg ? (
                <Chip size="small" icon={<TrendingUpIcon sx={{ fontSize: 14, color: `${seg.color} !important` }} />} label={seg.label}
                  sx={{ bgcolor: seg.bg, color: seg.color, fontWeight: 700, fontSize: 11, flexShrink: 0 }} />
              ) : null}
            </Stack>

            {current ? (
              <>
                {/* E-post */}
                <Box sx={{ p: 1.6, borderRadius: 2.2, bgcolor: 'rgba(15,23,42,0.55)', border: '1px solid rgba(148,163,184,0.16)' }}>
                  <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mb: 1 }}>
                    <DraftsIcon sx={{ fontSize: 16, color: ACCENT }} />
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {current.label}-e-post · Trinn {current.step} av {steps.length}
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 10.5, color: MUTED, mb: 0.3 }}>Emne</Typography>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: INK, mb: 1.2, lineHeight: 1.3 }}>{current.subject}</Typography>
                  <Typography sx={{ fontSize: 13.5, color: 'rgba(226,232,240,0.88)', whiteSpace: 'pre-line', lineHeight: 1.55 }}>{current.body}</Typography>

                  {/* Innsikt-blokk (Verdi) */}
                  {current.insightStat || current.insightHead ? (
                    <Box sx={{ mt: 1.4, p: 1.2, borderRadius: 2, border: '1px solid rgba(167,139,250,0.28)', background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(217,70,239,0.06))' }}>
                      <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mb: 0.5 }}>
                        <InsightsIcon sx={{ fontSize: 16, color: ACCENT }} />
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#e9d5ff' }}>{current.insightHead || 'Gratis innsikt'}</Typography>
                      </Stack>
                      {current.insightSub ? <Typography sx={{ fontSize: 12.5, color: 'rgba(226,232,240,0.82)', mb: current.insightStat ? 0.8 : 0 }}>{current.insightSub}</Typography> : null}
                      {current.insightStat ? (
                        <Stack direction="row" alignItems="baseline" spacing={0.7}>
                          <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1, background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{current.insightStat}</Typography>
                          {current.insightUnit ? <Typography sx={{ fontSize: 12.5, color: MUTED }}>{current.insightUnit}</Typography> : null}
                        </Stack>
                      ) : null}
                    </Box>
                  ) : null}
                </Box>

                {/* Agent-tips + planlegging */}
                <Stack direction="row" alignItems="center" spacing={0.7} sx={{ px: 0.4 }}>
                  <AutoFixHighIcon sx={{ fontSize: 15, color: ACCENT, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 11.5, color: MUTED, lineHeight: 1.4 }}>
                    Agent-tips: sendes {current.sendOffsetDays === 0 ? 'med en gang' : `dag ${current.sendOffsetDays}`} · gir verdi før salg
                  </Typography>
                </Stack>

                <Stack direction="row" alignItems="center" spacing={1}>
                  <Chip size="small" icon={<ScheduleSendIcon sx={{ fontSize: 14, color: `${ACCENT} !important` }} />}
                    label={current.sendOffsetDays === 0 ? 'Sendes nå · 09:00' : `Sendes dag ${current.sendOffsetDays} · 09:00`}
                    sx={{ bgcolor: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.28)', color: '#c4b5fd', fontWeight: 600, fontSize: 11.5 }} />
                  <Box sx={{ flex: 1 }} />
                  {sequence.status === 'queued' ? (
                    <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: 15, color: '#34d399 !important' }} />} label="Planlagt"
                      sx={{ bgcolor: 'rgba(52,211,153,0.16)', color: '#34d399', fontWeight: 700, fontSize: 11.5 }} />
                  ) : (
                    <Button onClick={() => void queue()} disabled={busy} variant="contained" disableElevation size="small"
                      startIcon={busy ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <PlaylistAddCheckIcon />}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, background: GRAD, color: '#fff', '&:hover': { background: GRAD, filter: 'brightness(1.06)' } }}>
                      Legg i sekvens
                    </Button>
                  )}
                </Stack>

                <Button onClick={() => void generate()} disabled={generating} size="small" variant="text"
                  startIcon={generating ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <AutoAwesomeIcon fontSize="small" />}
                  sx={{ textTransform: 'none', fontWeight: 700, color: ACCENT, alignSelf: 'flex-start' }}>
                  Generer på nytt
                </Button>
              </>
            ) : null}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
