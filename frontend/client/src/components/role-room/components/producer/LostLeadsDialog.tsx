/**
 * LostLeadsDialog — «Tapte leads» med vinn-tilbake-analyse (porter ld-tapte).
 * Aggregat (antall · klare for re-kontakt · estimert verdi) er ekte tall.
 * Tapsårsak + vinn-tilbake-grep + lærings-innsikt er Claude-analysert
 * (tapsårsak lagres ikke) — tydelig som Agentens vurdering.
 *
 * Backend: /api/role-room/leads/lost-analysis.
 */

import * as React from 'react';
import { Dialog, DialogContent, Box, Stack, Typography, Chip, IconButton, CircularProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import ReplayIcon from '@mui/icons-material/Replay';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PaymentsIcon from '@mui/icons-material/Payments';
import HandshakeIcon from '@mui/icons-material/Handshake';
import HeartBrokenIcon from '@mui/icons-material/HeartBroken';
import InsightsIcon from '@mui/icons-material/Insights';
import roleRoomAgentService from '../../services/roleRoomAgentService';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

export interface LostLead {
  id: string;
  name: string | null;
  company?: string | null;
  platform?: string | null;
  valueKr: number;
  segmentReason?: string | null;
  hasContact: boolean;
  daysSinceCreated?: number | null;
}

export interface LostLeadsDialogProps {
  open: boolean;
  onClose: () => void;
  leads: LostLead[];
}

function fmtKr(n: number): string { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

function reasonIcon(reason: string): React.ReactElement {
  const r = reason.toLowerCase();
  if (r.includes('svar') || r.includes('tid')) return <ScheduleIcon sx={{ fontSize: 14 }} />;
  if (r.includes('pris') || r.includes('budsjett')) return <PaymentsIcon sx={{ fontSize: 14 }} />;
  if (r.includes('konkurrent')) return <HandshakeIcon sx={{ fontSize: 14 }} />;
  return <HeartBrokenIcon sx={{ fontSize: 14 }} />;
}

export default function LostLeadsDialog({ open, onClose, leads }: LostLeadsDialogProps): React.ReactElement {
  const [loading, setLoading] = React.useState(false);
  const [analyses, setAnalyses] = React.useState<Record<string, { lossReason: string; winBack: string }>>({});
  const [insight, setInsight] = React.useState('');

  React.useEffect(() => {
    if (!open || leads.length === 0) return;
    let cancelled = false;
    setLoading(true);
    void roleRoomAgentService.analyzeLostLeads(leads.map((l) => ({
      id: l.id, name: l.name, company: l.company, platform: l.platform, valueKr: l.valueKr, segmentReason: l.segmentReason, daysSinceCreated: l.daysSinceCreated,
    }))).then((r) => {
      if (cancelled) return;
      const map: Record<string, { lossReason: string; winBack: string }> = {};
      for (const a of r.analyses) map[a.id] = { lossReason: a.lossReason, winBack: a.winBack };
      setAnalyses(map);
      setInsight(r.insight);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, leads]);

  const totalValue = leads.reduce((a, l) => a + (l.valueKr || 0), 0);
  const reContact = leads.filter((l) => l.hasContact).length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)', border: '1px solid rgba(167,139,250,0.2)' } }}>
      <DialogContent sx={{ p: { xs: 2, md: 2.8 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{ width: 28, height: 28, borderRadius: 1.3, display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 6px 16px rgba(168,85,247,0.45)' }}>
              <AutoAwesomeIcon sx={{ fontSize: 16, color: '#fff' }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: INK, lineHeight: 1.1 }}>Tapte leads</Typography>
              <Typography sx={{ fontSize: 11.5, color: MUTED }}>The Role Room · Lead-innsikt</Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(226,232,240,0.5)' }}><CloseIcon fontSize="small" /></IconButton>
        </Stack>

        <Typography sx={{ fontSize: 12.5, color: MUTED, mb: 1.8, lineHeight: 1.5 }}>
          Agenten har analysert hvorfor disse henvendelsene falt fra — og foreslår et konkret vinn-tilbake-grep for hver.
        </Typography>

        {/* Aggregat */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 2 }}>
          {[
            { num: String(leads.length), label: 'Tapte' },
            { num: String(reContact), label: 'Klare for re-kontakt' },
            { num: fmtKr(totalValue), label: 'Estimert verdi (kr)' },
          ].map((s) => (
            <Box key={s.label} sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.14)', textAlign: 'center' }}>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: INK, lineHeight: 1 }}>{s.num}</Typography>
              <Typography sx={{ fontSize: 10.5, color: MUTED, mt: 0.4 }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>

        {leads.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: INK, mb: 0.5 }}>Ingen tapte leads</Typography>
            <Typography sx={{ fontSize: 12.5, color: MUTED }}>Sett leads til «Tapt» for å få vinn-tilbake-analyse her.</Typography>
          </Box>
        ) : (
          <>
            <Stack spacing={1}>
              {leads.map((l) => {
                const a = analyses[l.id];
                return (
                  <Box key={l.id} sx={{ p: 1.4, borderRadius: 2.2, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.14)' }}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: INK }}>
                          {l.company || l.name || 'Ukjent'}{l.platform ? <Box component="span" sx={{ color: MUTED, fontWeight: 400 }}> · {l.platform}</Box> : null}
                        </Typography>
                        {l.valueKr ? <Typography sx={{ fontSize: 12, color: MUTED }}>{fmtKr(l.valueKr)} kr</Typography> : null}
                      </Box>
                      {a ? (
                        <Chip size="small" icon={React.cloneElement(reasonIcon(a.lossReason), { sx: { color: '#fbbf24 !important' } })} label={a.lossReason}
                          sx={{ bgcolor: 'rgba(251,191,36,0.14)', color: '#fde68a', fontWeight: 700, fontSize: 10.5, flexShrink: 0 }} />
                      ) : loading ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : null}
                    </Stack>
                    {a ? (
                      <Stack direction="row" alignItems="flex-start" spacing={0.8} sx={{ mt: 1, p: 1, borderRadius: 1.6, bgcolor: 'rgba(168,85,247,0.1)', border: '1px solid rgba(167,139,250,0.24)' }}>
                        <ReplayIcon sx={{ fontSize: 16, color: ACCENT, mt: 0.2, flexShrink: 0 }} />
                        <Box>
                          <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 700, color: '#e9d5ff' }}>Vinn tilbake: </Typography>
                          <Typography component="span" sx={{ fontSize: 12.5, color: 'rgba(226,232,240,0.86)' }}>{a.winBack}</Typography>
                        </Box>
                      </Stack>
                    ) : null}
                  </Box>
                );
              })}
            </Stack>

            {/* Lærings-innsikt */}
            {insight ? (
              <Stack direction="row" alignItems="flex-start" spacing={0.9} sx={{ mt: 1.8, p: 1.2, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.4)', border: '1px solid rgba(148,163,184,0.12)' }}>
                <InsightsIcon sx={{ fontSize: 17, color: ACCENT, mt: 0.1, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>{insight}</Typography>
              </Stack>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
