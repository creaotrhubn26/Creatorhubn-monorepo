/**
 * OverviewTab.tsx — faglærer-forsiden. Aggregerer på tvers av alle kull:
 * frister, til-vurdering-kø, manglende innleveringer og aktive produksjoner.
 * Kortene og lista er klikkbare → hopper til riktig fane.
 */

import { useEffect, useState } from 'react';
import {
  Box, Stack, Typography, Card, CardContent, CardActionArea, Chip,
  CircularProgress, Alert, Divider,
} from '@mui/material';
import {
  Schedule as DueIcon, Grading as ReviewIcon, ErrorOutline as MissingIcon,
  MovieCreation as ProductionIcon,
} from '@mui/icons-material';
import { educationOverviewService, type OverviewData } from './educationOverviewService';

const ACCENT = '#8B5CF6';

type TabId = 'overview' | 'cohorts' | 'productions' | 'assignments' | 'fagstoff' | 'assessment' | 'portfolio' | 'faculty';

function formatDue(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
    const date = d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' });
    if (days <= 0) return `${date} · i dag`;
    if (days === 1) return `${date} · i morgen`;
    return `${date} · om ${days} dager`;
  } catch { return ''; }
}

export function OverviewTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void educationOverviewService.getOverview()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Kunne ikke hente oversikt'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress sx={{ color: ACCENT }} /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const { stats, dueSoon, reviewQueue } = data;
  const cards: { label: string; value: number; icon: React.ReactNode; tab: TabId; color: string }[] = [
    { label: 'Frister denne uken', value: stats.dueThisWeek, icon: <DueIcon />, tab: 'assignments', color: ACCENT },
    { label: 'Til vurdering', value: stats.toReview, icon: <ReviewIcon />, tab: 'assessment', color: '#10b981' },
    { label: 'Manglende innleveringer', value: stats.missingSubmissions, icon: <MissingIcon />, tab: 'assessment', color: stats.missingSubmissions > 0 ? '#ef4444' : ACCENT },
    { label: 'Aktive produksjoner', value: stats.productions, icon: <ProductionIcon />, tab: 'productions', color: ACCENT },
  ];

  const nothing = stats.dueThisWeek === 0 && stats.toReview === 0 && stats.missingSubmissions === 0 && stats.productions === 0
    && dueSoon.length === 0 && reviewQueue.length === 0;

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {cards.map((k) => (
          <Card key={k.label} sx={{ flex: '1 1 200px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
            <CardActionArea onClick={() => onNavigate(k.tab)} sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography sx={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{k.label}</Typography>
                </Box>
                <Box sx={{ color: k.color, opacity: 0.5, '& svg': { fontSize: 30 } }}>{k.icon}</Box>
              </Stack>
            </CardActionArea>
          </Card>
        ))}
      </Stack>

      {nothing && (
        <Card sx={{ bgcolor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.24)', borderRadius: 3 }}>
          <CardContent sx={{ textAlign: 'center', p: 4 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.72)' }}>Alt er i rute — ingen frister, kø eller manglende leveranser. Opprett kull og oppgaver for å komme i gang.</Typography>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        {dueSoon.length > 0 && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
              <DueIcon sx={{ fontSize: 18, color: ACCENT }} />
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Kommende frister</Typography>
            </Stack>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <CardActionArea onClick={() => onNavigate('assignments')}>
                {dueSoon.map((a, i) => (
                  <Box key={a.assignmentId}>
                    {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.25 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{a.title}</Typography>
                        {a.cohortName && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{a.cohortName}</Typography>}
                      </Box>
                      <Chip size="small" label={formatDue(a.dueAt)} sx={{ height: 22, fontSize: 10.5, bgcolor: 'rgba(139,92,246,0.18)', color: '#e9d5ff' }} />
                    </Stack>
                  </Box>
                ))}
              </CardActionArea>
            </Card>
          </Box>
        )}

        {reviewQueue.length > 0 && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
              <ReviewIcon sx={{ fontSize: 18, color: '#10b981' }} />
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Venter på vurdering</Typography>
            </Stack>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <CardActionArea onClick={() => onNavigate('assessment')}>
                {reviewQueue.map((s, i) => (
                  <Box key={s.submissionId}>
                    {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.25 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{s.studentName}</Typography>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s.assignmentTitle}{s.cohortName ? ` · ${s.cohortName}` : ''}</Typography>
                      </Box>
                      <Chip size="small" label="Levert" sx={{ height: 22, fontSize: 10.5, color: '#10b981', borderColor: '#10b981' }} variant="outlined" />
                    </Stack>
                  </Box>
                ))}
              </CardActionArea>
            </Card>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default OverviewTab;
