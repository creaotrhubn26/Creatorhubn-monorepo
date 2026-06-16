/**
 * AgentRecommendationsFeed — feed av Agent-anbefalinger i The Role Room Agent.
 * Henter åpne anbefalinger, viser dem som AgentRecommendationCard, og lar
 * brukeren «Utfør» (done) eller avvise (dismissed). Tom feed → «Generer
 * anbefalinger» (seeder kuratert sett i v1).
 *
 * Backend: /api/role-room/agent/recommendations (mig 284).
 */

import * as React from 'react';
import { Box, Stack, Typography, Button, CircularProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { roleRoomAgentService, type RoleRoomAgentRecommendation } from '../services/roleRoomAgentService';
import { AgentRecommendationCard } from './AgentRecommendationCard';

const ACCENT = '#a855f7';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';

export interface AgentRecommendationsFeedProps {
  projectId?: string | null;
}

export function AgentRecommendationsFeed({ projectId }: AgentRecommendationsFeedProps): React.ReactElement {
  const [recs, setRecs] = React.useState<RoleRoomAgentRecommendation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void roleRoomAgentService.getRecommendations(projectId)
      .then((r) => { if (!cancelled) setRecs(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const generate = async (): Promise<void> => {
    setGenerating(true);
    try {
      const created = await roleRoomAgentService.generateRecommendations(projectId);
      if (created.length) setRecs((prev) => [...created, ...prev]);
      else setRecs(await roleRoomAgentService.getRecommendations(projectId));
    } finally { setGenerating(false); }
  };

  const resolve = async (id: string, status: 'done' | 'dismissed'): Promise<void> => {
    setBusyId(id);
    const ok = await roleRoomAgentService.patchRecommendation(id, status);
    setBusyId(null);
    if (ok) setRecs((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading) {
    return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} sx={{ color: ACCENT }} /></Box>;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box sx={{ width: 34, height: 34, borderRadius: 1.5, display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 6px 16px rgba(168,85,247,0.45)' }}>
            <AutoAwesomeIcon sx={{ fontSize: 19, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#f5f3ff', lineHeight: 1.1 }}>Agent-anbefalinger</Typography>
            <Typography sx={{ fontSize: 12.5, color: 'rgba(226,232,240,0.6)' }}>Handlingsrettede forslag fra The Role Room Agent</Typography>
          </Box>
        </Stack>
        {recs.length > 0 ? (
          <Button onClick={() => void generate()} disabled={generating} size="small" variant="outlined"
            sx={{ textTransform: 'none', fontWeight: 700, borderColor: 'rgba(168,85,247,0.4)', color: ACCENT }}>
            {generating ? <CircularProgress size={16} sx={{ color: ACCENT }} /> : 'Oppdater'}
          </Button>
        ) : null}
      </Stack>

      {recs.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, border: '1px dashed rgba(168,85,247,0.3)', borderRadius: 3 }}>
          <AutoAwesomeIcon sx={{ fontSize: 40, color: ACCENT, mb: 1 }} />
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#f5f3ff', mb: 0.5 }}>Ingen anbefalinger ennå</Typography>
          <Typography sx={{ fontSize: 13.5, color: 'rgba(226,232,240,0.6)', mb: 2.5, maxWidth: 380, mx: 'auto' }}>
            La Agenten foreslå neste steg — beste publiseringstid, quiz-ideer, leads å følge opp, budsjett-grep og mer.
          </Typography>
          <Button onClick={() => void generate()} disabled={generating} variant="contained" disableElevation
            startIcon={generating ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <AutoAwesomeIcon />}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, background: GRAD, color: '#fff', '&:hover': { background: GRAD, filter: 'brightness(1.06)' } }}>
            Generer anbefalinger
          </Button>
        </Box>
      ) : (
        <Stack spacing={1.75}>
          {recs.map((rec) => (
            <AgentRecommendationCard
              key={rec.id}
              rec={rec}
              busy={busyId === rec.id}
              onDone={() => void resolve(rec.id, 'done')}
              onDismiss={() => void resolve(rec.id, 'dismissed')}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
