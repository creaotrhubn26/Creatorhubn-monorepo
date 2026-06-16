/**
 * SentimentDonutCard — «Stemningen rundt merkevaren» (porter mp-sentiment).
 * Donut over Positiv/Nøytral/Negativ siste 30 dager fra social_events +
 * Agent-innsikt. Brukes i BÅDE markedsplan (produsent) og månedsrapporten
 * (produsent + klient).
 *
 * Backend: /api/role-room/sentiment + /api/client/portal/sentiment.
 */

import * as React from 'react';
import { Box, Stack, Typography, CircularProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SentimentVerySatisfiedIcon from '@mui/icons-material/SentimentVerySatisfied';
import SentimentNeutralIcon from '@mui/icons-material/SentimentNeutral';
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied';
import roleRoomAgentService, { type RoleRoomSentiment } from '../../services/roleRoomAgentService';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

const POS = '#a855f7';
const NEU = '#64748b';
const NEG = '#f87171';

export interface SentimentDonutCardProps {
  projectId?: string | null;
  clientToken?: string | null;
  days?: number;
}

function insightText(s: RoleRoomSentiment): string {
  if (s.total === 0) return 'Ingen reaksjoner registrert ennå — tallene fylles inn etter hvert som publikum engasjerer seg.';
  if (s.positivePct >= 60) return 'Agenten ser overveiende positiv stemning — publikum responderer godt på de siste innleggene.';
  if (s.negativePct >= 30) return 'Agenten ser økende negativ stemning — verdt å følge opp og svare raskt på kritikk.';
  return 'Agenten ser blandet stemning — det er rom for å løfte tonen med mer engasjerende innhold.';
}

export default function SentimentDonutCard({ projectId, clientToken, days = 30 }: SentimentDonutCardProps): React.ReactElement {
  const [s, setS] = React.useState<RoleRoomSentiment | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const p = clientToken
      ? roleRoomAgentService.fetchClientSentiment(clientToken, days)
      : roleRoomAgentService.fetchSentiment(days);
    void p.then((r) => { if (!cancelled) setS(r); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, clientToken, days]);

  // SVG-donut
  const R = 40;
  const C = 2 * Math.PI * R;
  const GAP = 4;
  const segs = s ? [
    { pct: s.positivePct, color: POS },
    { pct: s.neutralPct, color: NEU },
    { pct: s.negativePct, color: NEG },
  ] : [];
  let offset = 0;
  const arcs = segs.map((seg) => {
    const len = Math.max(0, (seg.pct / 100) * C - (seg.pct > 0 ? GAP : 0));
    const arc = { len, dash: `${len} ${C - len}`, off: -((offset / 100) * C), color: seg.color };
    offset += seg.pct;
    return arc;
  });

  return (
    <Box sx={{
      position: 'relative', borderRadius: 3, p: { xs: 2, md: 2.4 }, mb: 1.5, overflow: 'hidden',
      border: '1px solid rgba(167,139,250,0.2)',
      background: 'radial-gradient(120% 90% at 100% -10%, rgba(217,70,239,0.14), transparent 55%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
    }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Markedsplan · Sentiment</Typography>
          <Typography sx={{ fontSize: 15.5, fontWeight: 800, color: INK, lineHeight: 1.15 }}>Stemningen rundt merkevaren</Typography>
          <Typography sx={{ fontSize: 11.5, color: MUTED }}>Fordeling av reaksjoner siste {days} dager</Typography>
        </Box>
        <Box sx={{ width: 28, height: 28, borderRadius: 1.4, display: 'grid', placeItems: 'center', background: GRAD, flexShrink: 0 }}>
          <AutoAwesomeIcon sx={{ fontSize: 16, color: '#fff' }} />
        </Box>
      </Stack>

      {loading ? (
        <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box>
      ) : (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems="center">
          {/* Donut */}
          <Box sx={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
            <Box component="svg" viewBox="0 0 100 100" sx={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth="10" />
              {arcs.map((a, i) => (
                <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={a.color} strokeWidth="10"
                  strokeDasharray={a.dash} strokeDashoffset={a.off} strokeLinecap="round" />
              ))}
            </Box>
            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: INK, lineHeight: 1 }}>{s?.positivePct ?? 0}%</Typography>
                <Typography sx={{ fontSize: 10.5, color: MUTED }}>Positiv</Typography>
              </Box>
            </Box>
          </Box>

          {/* Legend */}
          <Stack spacing={0.8} sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            {[
              { icon: <SentimentVerySatisfiedIcon sx={{ fontSize: 17, color: POS }} />, label: 'Positiv', pct: s?.positivePct ?? 0, color: POS },
              { icon: <SentimentNeutralIcon sx={{ fontSize: 17, color: NEU }} />, label: 'Nøytral', pct: s?.neutralPct ?? 0, color: NEU },
              { icon: <SentimentDissatisfiedIcon sx={{ fontSize: 17, color: NEG }} />, label: 'Negativ', pct: s?.negativePct ?? 0, color: NEG },
            ].map((r) => (
              <Stack key={r.label} direction="row" alignItems="center" spacing={1}>
                {r.icon}
                <Typography sx={{ fontSize: 13, color: INK, flex: 1 }}>{r.label}</Typography>
                <Box sx={{ width: 90, height: 6, borderRadius: 3, bgcolor: 'rgba(148,163,184,0.14)', overflow: 'hidden' }}>
                  <Box sx={{ width: `${r.pct}%`, height: '100%', bgcolor: r.color }} />
                </Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: INK, minWidth: 38, textAlign: 'right' }}>{r.pct}%</Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}

      {/* Agent-innsikt */}
      {!loading && s ? (
        <Stack direction="row" alignItems="flex-start" spacing={0.9} sx={{ mt: 1.8, pt: 1.4, borderTop: '1px solid rgba(148,163,184,0.12)' }}>
          <AutoAwesomeIcon sx={{ fontSize: 16, color: ACCENT, mt: 0.1, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 12.5, color: 'rgba(226,232,240,0.86)', lineHeight: 1.45 }}>{insightText(s)}</Typography>
        </Stack>
      ) : null}
    </Box>
  );
}
