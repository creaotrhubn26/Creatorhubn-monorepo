/**
 * AdAudiencePanel — «hvem annonsen treffer» (porter adv-malgruppe-designet).
 * Det finnes ingen ekte Meta-delivery-insights-kilde ennå, så Agenten
 * ESTIMERER målgruppen (rekkevidde, alder, kjønn, sted, interesser) med Claude
 * fra firmaprofilen — tydelig merket som AI-estimat.
 *
 * Backend: /api/role-room/ad-audience (mig 287).
 */

import * as React from 'react';
import { Box, Stack, Typography, Chip, Button, CircularProgress, LinearProgress, Tooltip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GroupsIcon from '@mui/icons-material/Groups';
import CakeIcon from '@mui/icons-material/Cake';
import WcIcon from '@mui/icons-material/Wc';
import PlaceIcon from '@mui/icons-material/Place';
import InterestsIcon from '@mui/icons-material/Interests';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import roleRoomAgentService, { type RoleRoomAdAudience } from '../../services/roleRoomAgentService';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

export interface AdAudiencePanelProps {
  projectId: string;
  platform?: string;
  companyName?: string | null;
  industry?: string | null;
  targetAudience?: string | string[] | null;
}

function fmtInt(n: number): string { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

export default function AdAudiencePanel({ projectId, platform = 'meta', companyName, industry, targetAudience }: AdAudiencePanelProps): React.ReactElement {
  const [audience, setAudience] = React.useState<RoleRoomAdAudience | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    void roleRoomAgentService.getAdAudience(projectId, platform)
      .then((a) => { if (!cancelled) setAudience(a); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, platform]);

  const generate = async (): Promise<void> => {
    setGenerating(true);
    try {
      const created = await roleRoomAgentService.generateAdAudience({ projectId, platform, companyName, industry, targetAudience });
      if (created) setAudience(created);
    } finally { setGenerating(false); }
  };

  const maxAge = Math.max(1, ...(audience?.ages ?? []).map((a) => a.pct));
  const female = audience?.female_pct ?? null;

  return (
    <Box sx={{
      position: 'relative', borderRadius: 3, p: { xs: 2, md: 2.4 }, overflow: 'hidden',
      border: '1px solid rgba(167,139,250,0.2)',
      background: 'radial-gradient(120% 90% at 100% -10%, rgba(217,70,239,0.16), transparent 55%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
      boxShadow: '0 14px 40px rgba(124,58,237,0.22)',
    }}>
      <Stack direction="row" alignItems="center" spacing={1.1} sx={{ mb: 1.4 }}>
        <Box sx={{ width: 28, height: 28, borderRadius: 1.4, display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 6px 16px rgba(168,85,247,0.45)' }}>
          <AutoAwesomeIcon sx={{ fontSize: 16, color: '#fff' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: INK, lineHeight: 1.1 }}>Annonse-målgruppe</Typography>
          <Typography sx={{ fontSize: 11.5, color: MUTED }}>Hvem annonsen treffer · AI-estimat</Typography>
        </Box>
      </Stack>

      {loading ? (
        <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box>
      ) : !audience ? (
        <Box sx={{ textAlign: 'center', py: 2.5 }}>
          <GroupsIcon sx={{ fontSize: 34, color: ACCENT, mb: 1 }} />
          <Typography sx={{ fontSize: 13, color: MUTED, mb: 1.6, maxWidth: 360, mx: 'auto' }}>
            La Agenten estimere hvem annonsen treffer — rekkevidde, alder, kjønn, sted og interesser.
          </Typography>
          <Button onClick={() => void generate()} disabled={generating} variant="contained" disableElevation
            startIcon={generating ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <AutoAwesomeIcon />}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, background: GRAD, color: '#fff', '&:hover': { background: GRAD, filter: 'brightness(1.06)' } }}>
            Estimer målgruppe
          </Button>
        </Box>
      ) : (
        <Stack spacing={1.8}>
          {/* Navn + rekkevidde */}
          <Box sx={{ p: 1.4, borderRadius: 2.2, bgcolor: 'rgba(168,85,247,0.1)', border: '1px solid rgba(167,139,250,0.28)' }}>
            <Typography sx={{ fontSize: 12.5, color: MUTED }}>Agenten har bygget en målgruppe på</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: INK, mb: 0.8 }}>{audience.audience_name || 'Målgruppe'}</Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <GroupsIcon sx={{ fontSize: 18, color: ACCENT }} />
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: INK, lineHeight: 1 }}>{fmtInt(audience.estimated_reach ?? 0)}</Typography>
              <Typography sx={{ fontSize: 12, color: MUTED }}>personer per uke i valgt område</Typography>
            </Stack>
          </Box>

          {/* Alder */}
          {audience.ages.length > 0 ? (
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mb: 0.8 }}>
                <CakeIcon sx={{ fontSize: 16, color: ACCENT }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#c4b5fd' }}>Aldersfordeling</Typography>
              </Stack>
              <Stack spacing={0.6}>
                {audience.ages.map((a) => (
                  <Stack key={a.lbl} direction="row" alignItems="center" spacing={1}>
                    <Typography sx={{ fontSize: 11.5, color: MUTED, minWidth: 46, fontFamily: 'monospace' }}>{a.lbl}</Typography>
                    <Box sx={{ flex: 1 }}>
                      <LinearProgress variant="determinate" value={(a.pct / maxAge) * 100}
                        sx={{ height: 7, borderRadius: 4, bgcolor: 'rgba(148,163,184,0.14)', '& .MuiLinearProgress-bar': { borderRadius: 4, background: GRAD } }} />
                    </Box>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: INK, minWidth: 34, textAlign: 'right' }}>{a.pct} %</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          ) : null}

          {/* Kjønn */}
          {female != null ? (
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mb: 0.7 }}>
                <WcIcon sx={{ fontSize: 16, color: ACCENT }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#c4b5fd' }}>Kjønn</Typography>
              </Stack>
              <Box sx={{ display: 'flex', height: 22, borderRadius: 999, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.16)' }}>
                <Box sx={{ width: `${female}%`, background: GRAD, display: 'grid', placeItems: 'center' }}>
                  <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#fff' }}>Kvinner {female} %</Typography>
                </Box>
                <Box sx={{ width: `${100 - female}%`, bgcolor: 'rgba(96,165,250,0.4)', display: 'grid', placeItems: 'center' }}>
                  <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#fff' }}>{100 - female} % Menn</Typography>
                </Box>
              </Box>
            </Box>
          ) : null}

          {/* Sted + interesser */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
            {audience.locations.length > 0 ? (
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mb: 0.7 }}>
                  <PlaceIcon sx={{ fontSize: 16, color: ACCENT }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#c4b5fd' }}>Sted</Typography>
                </Stack>
                <Stack spacing={0.4}>
                  {audience.locations.map((l) => (
                    <Stack key={l.name} direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: 12.5, color: INK }}>{l.name}</Typography>
                      <Typography sx={{ fontSize: 12.5, color: MUTED, fontWeight: 700 }}>{l.pct} %</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ) : null}
            {audience.interests.length > 0 ? (
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mb: 0.7 }}>
                  <InterestsIcon sx={{ fontSize: 16, color: ACCENT }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#c4b5fd' }}>Interesser</Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {audience.interests.map((it) => (
                    <Chip key={it.t} size="small"
                      icon={it.hot ? <LocalFireDepartmentIcon sx={{ fontSize: 13, color: '#fb923c !important' }} /> : undefined}
                      label={it.t}
                      sx={{ fontSize: 11, fontWeight: 600, color: it.hot ? '#fde68a' : '#e9d5ff', bgcolor: it.hot ? 'rgba(251,146,60,0.16)' : 'rgba(168,85,247,0.14)' }} />
                  ))}
                </Stack>
              </Box>
            ) : null}
          </Stack>

          <Tooltip title="Estimer på nytt">
            <Button onClick={() => void generate()} disabled={generating} size="small" variant="text"
              startIcon={generating ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <AutoAwesomeIcon fontSize="small" />}
              sx={{ textTransform: 'none', fontWeight: 700, color: ACCENT, alignSelf: 'flex-start' }}>
              Estimer på nytt
            </Button>
          </Tooltip>
        </Stack>
      )}
    </Box>
  );
}
