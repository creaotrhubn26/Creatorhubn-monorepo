/**
 * SeasonPlanCard — sesongplan for "season"-fanen i DanceWorkspace.
 *
 * Porter overlay-designet (rr-dance-sesong): tittel + undertittel + en
 * vertikal milepæl-tidslinje (nådd/kommende) + samlet fremdrift
 * («milepæler nådd 2/5 · 26 %»). Klikk en milepæl for å markere nådd/ikke.
 *
 * Backend: dance_season (mig 0155) via /api/dance/studio/season (GET/PUT).
 * Milepæler ligger som JSONB-array; vi laster, redigerer lokalt og lagrer.
 */

import * as React from 'react';
import { Box, Stack, Typography, Button, TextField, CircularProgress } from '@mui/material';
import TheaterComedyOutlinedIcon from '@mui/icons-material/TheaterComedyOutlined';
import FlightTakeoffOutlinedIcon from '@mui/icons-material/FlightTakeoffOutlined';
import DirectionsRunOutlinedIcon from '@mui/icons-material/DirectionsRunOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AddIcon from '@mui/icons-material/Add';
import { danceFlowColors } from './danceFlowTheme';
import {
  fetchSeason, saveSeason,
  type DanceSeason, type SeasonMilestone,
} from './danceStudioOpsService';

const ACCENT = danceFlowColors.lavender;
const ACCENT_DEEP = danceFlowColors.lavenderDeep;
const MUTED = 'rgba(229,231,235,0.45)';

const ICON_CYCLE = [TheaterComedyOutlinedIcon, FlightTakeoffOutlinedIcon, DirectionsRunOutlinedIcon, GroupsOutlinedIcon, EmojiEventsOutlinedIcon];
const ICON_BY_NAME: Record<string, typeof TheaterComedyOutlinedIcon> = {
  theater: TheaterComedyOutlinedIcon, flight: FlightTakeoffOutlinedIcon,
  run: DirectionsRunOutlinedIcon, groups: GroupsOutlinedIcon, trophy: EmojiEventsOutlinedIcon,
};

let _mid = 0;
const newId = (): string => `msn_${Date.now()}_${_mid++}`;

export interface SeasonPlanCardProps {
  projectId: string | null;
}

export function SeasonPlanCard({ projectId }: SeasonPlanCardProps): React.ReactElement | null {
  const [season, setSeason] = React.useState<DanceSeason | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState<{ title: string; dateLabel: string }>({ title: '', dateLabel: '' });

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchSeason(projectId).then((s) => { if (!cancelled) setSeason(s); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const persist = React.useCallback(async (next: DanceSeason) => {
    setSeason(next);
    setSaving(true);
    try {
      const saved = await saveSeason({ label: next.label, subtitle: next.subtitle, milestones: next.milestones, projectId });
      setSeason(saved);
    } finally { setSaving(false); }
  }, [projectId]);

  const createSeason = async (): Promise<void> => {
    const year = 2026;
    const saved = await saveSeason({
      label: `Sesong ${year}`,
      subtitle: 'Helårsplan for kompani og elevgrupper',
      milestones: [
        { id: newId(), title: 'Sesongstart & opptak', dateLabel: 'September', status: 'upcoming', icon: 'theater' },
        { id: newId(), title: 'Vinterforestilling', dateLabel: 'Desember', status: 'upcoming', icon: 'flight' },
        { id: newId(), title: 'Vårpremiere', dateLabel: 'Juni', status: 'upcoming', icon: 'trophy' },
      ],
      projectId,
    });
    setSeason(saved);
  };

  const toggle = (id: string): void => {
    if (!season) return;
    const milestones = season.milestones.map((m) => m.id === id ? { ...m, status: m.status === 'done' ? 'upcoming' as const : 'done' as const } : m);
    void persist({ ...season, milestones });
  };

  const addMilestone = (): void => {
    if (!season || !draft.title.trim()) return;
    const m: SeasonMilestone = { id: newId(), title: draft.title.trim(), dateLabel: draft.dateLabel.trim(), status: 'upcoming' };
    void persist({ ...season, milestones: [...season.milestones, m] });
    setDraft({ title: '', dateLabel: '' });
    setAdding(false);
  };

  if (loading) {
    return <Box sx={{ p: 3 }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box>;
  }

  const cardSx = {
    position: 'relative' as const, bgcolor: danceFlowColors.bgCard,
    border: `1px solid ${danceFlowColors.borderStrong}`, borderRadius: 3,
    p: { xs: 2.5, md: 3.5 }, maxWidth: 680,
    background: `radial-gradient(620px 300px at 95% -10%, rgba(167,139,250,0.10), transparent 60%), ${danceFlowColors.bgCard}`,
  };

  // Brand-rad + tittel-header gjenbrukt i begge tilstander.
  const header = (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2.5 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})`, color: '#fff', fontWeight: 800, fontSize: 20 }}>R</Box>
      <Box>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1 }}>THE ROLE ROOM</Typography>
        <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: ACCENT }}>DANS · SESONG</Typography>
      </Box>
    </Stack>
  );

  if (!season) {
    return (
      <Box sx={cardSx}>
        {header}
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#fff', mb: 1 }}>Ingen sesongplan ennå</Typography>
        <Typography sx={{ fontSize: 14, color: 'rgba(229,231,235,0.7)', mb: 2.5 }}>
          Lag en helårsplan med milepæler for kompani og elevgrupper.
        </Typography>
        <Button onClick={() => void createSeason()} startIcon={<AddIcon />} variant="contained" disableElevation
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, background: `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})` }}>
          Opprett sesongplan
        </Button>
      </Box>
    );
  }

  const total = season.milestones.length;
  const done = season.milestones.filter((m) => m.status === 'done').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <Box sx={cardSx} data-testid="season-plan-card">
      {header}

      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: ACCENT, mb: 0.5 }}>SESONGPLAN</Typography>
      <Typography sx={{ fontSize: { xs: 30, md: 38 }, fontWeight: 800, color: '#fff', lineHeight: 1.05 }}>{season.label}</Typography>
      {season.subtitle ? <Typography sx={{ fontSize: 16, color: danceFlowColors.lavenderLight, mt: 0.75 }}>{season.subtitle}</Typography> : null}

      {/* Milepæl-tidslinje */}
      <Box sx={{ mt: 3, position: 'relative' }}>
        {season.milestones.map((m, i) => {
          const Icon = (m.icon && ICON_BY_NAME[m.icon]) || ICON_CYCLE[i % ICON_CYCLE.length];
          const isDone = m.status === 'done';
          const isLast = i === season.milestones.length - 1;
          return (
            <Stack key={m.id} direction="row" spacing={2} sx={{ cursor: 'pointer' }} onClick={() => toggle(m.id)}>
              {/* node + connector */}
              <Stack alignItems="center" sx={{ flex: 'none' }}>
                <Box sx={{
                  width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', position: 'relative',
                  background: isDone ? `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})` : 'rgba(167,139,250,0.06)',
                  border: `1.5px solid ${isDone ? ACCENT : 'rgba(167,139,250,0.22)'}`,
                  boxShadow: isDone ? `0 0 16px rgba(167,139,250,0.45)` : 'none',
                }}>
                  <Icon sx={{ fontSize: 22, color: isDone ? '#fff' : MUTED }} />
                  {isDone ? <Box sx={{ position: 'absolute', right: -3, bottom: -3, width: 18, height: 18, borderRadius: '50%', bgcolor: danceFlowColors.successDark, border: `2px solid ${danceFlowColors.bgCard}`, display: 'grid', placeItems: 'center' }}><CheckRoundedIcon sx={{ fontSize: 11, color: '#fff' }} /></Box> : null}
                </Box>
                {!isLast ? <Box sx={{ width: 2, flex: 1, minHeight: 22, my: 0.5, bgcolor: isDone ? ACCENT : 'rgba(167,139,250,0.18)' }} /> : null}
              </Stack>
              {/* tekst */}
              <Box sx={{ pb: isLast ? 0 : 2.5, pt: 0.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: isDone ? ACCENT : MUTED }}>{m.dateLabel || '—'}</Typography>
                <Typography sx={{ fontSize: 19, fontWeight: 800, color: isDone ? '#fff' : 'rgba(229,231,235,0.5)' }}>{m.title}</Typography>
              </Box>
            </Stack>
          );
        })}
      </Box>

      {/* Legg til milepæl */}
      {adding ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
          <TextField size="small" placeholder="Milepæl" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} sx={{ flex: 1, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: danceFlowColors.borderStrong } }} />
          <TextField size="small" placeholder="Dato (f.eks. 7. juni)" value={draft.dateLabel} onChange={(e) => setDraft((d) => ({ ...d, dateLabel: e.target.value }))} sx={{ width: { xs: '100%', sm: 180 }, '& .MuiInputBase-input': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: danceFlowColors.borderStrong } }} />
          <Button onClick={addMilestone} variant="contained" disableElevation sx={{ textTransform: 'none', fontWeight: 700, background: `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})` }}>Legg til</Button>
        </Stack>
      ) : (
        <Button onClick={() => setAdding(true)} startIcon={<AddIcon />} sx={{ mt: 1.5, textTransform: 'none', color: ACCENT, fontWeight: 700 }}>Legg til milepæl</Button>
      )}

      {/* Fremdrift-footer */}
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${danceFlowColors.borderStrong}` }}>
        <Box sx={{ flex: 'none' }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: MUTED }}>MILEPÆLER NÅDD</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{done}<Box component="span" sx={{ color: MUTED }}> / {total}</Box></Typography>
        </Box>
        <Box sx={{ flex: 1, width: '100%' }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: MUTED, mb: 0.75 }}>SESONGFREMDRIFT</Typography>
          <Box sx={{ height: 8, borderRadius: 99, bgcolor: 'rgba(167,139,250,0.14)', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: `linear-gradient(90deg, ${ACCENT_DEEP}, ${ACCENT})`, transition: 'width 240ms ease' }} />
          </Box>
        </Box>
        <Box sx={{ flex: 'none', textAlign: { sm: 'right' } }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: MUTED }}>FULLFØRT</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{pct}%</Typography>
        </Box>
        {saving ? <CircularProgress size={16} sx={{ color: ACCENT }} /> : null}
      </Stack>
    </Box>
  );
}
