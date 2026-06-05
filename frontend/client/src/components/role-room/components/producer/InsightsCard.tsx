// AI lead-innsikt — Claude analyserer alle leads og finner hva folk spør om +
// innholdsidéer produsenten kan mate inn i Markedsplan / Feed-planner. Lukker
// sløyfen fra leads tilbake til markedsføringen.
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';
import {
  Box, Stack, Typography, Button, Chip, Collapse, CircularProgress, Alert, Divider,
} from '@mui/material';
import { InsightsOutlined as InsightsIcon, AutoAwesome as AiIcon } from '@mui/icons-material';

interface LeadLite { name: string | null; segment: string | null; fields: Record<string, string> }
interface InsightsResult {
  success: boolean;
  summary?: string;
  themes?: Array<{ label: string; count: number }>;
  contentIdeas?: string[];
  recommendedActions?: string[];
  error?: string;
}

export default function InsightsCard({ connectionId, leads }: { connectionId: string; leads: LeadLite[] }) {
  const [open, setOpen] = useState(false);
  const run = useMutation<InsightsResult, Error, void>({
    mutationFn: async () =>
      apiRequest('/api/role-room/leads/producer/insights', {
        method: 'POST',
        body: JSON.stringify({ connectionId, leads: leads.map((l) => ({ name: l.name, segment: l.segment, fields: l.fields })) }),
      }),
  });
  const data = run.data;

  return (
    <Box sx={{ border: '1px solid rgba(34,211,238,0.3)', bgcolor: 'rgba(34,211,238,0.06)', borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.4, cursor: 'pointer' }} onClick={() => setOpen((v) => !v)}>
        <InsightsIcon sx={{ color: '#22d3ee' }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, color: '#f8fafc' }}>AI-innsikt fra leadsene</Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.6)' }}>
            Hva spør folk om? Få innholdsidéer å bruke i markedsplanen og feed-planneren.
          </Typography>
        </Box>
        <Typography sx={{ color: '#22d3ee', fontSize: '0.8rem', fontWeight: 700 }}>{open ? 'Skjul' : 'Vis'}</Typography>
      </Stack>
      <Collapse in={open}>
        <Box sx={{ px: 1.4, pb: 1.6 }}>
          <Button
            size="small" variant="contained" startIcon={<AiIcon sx={{ fontSize: 16 }} />}
            onClick={() => run.mutate()} disabled={leads.length === 0 || run.isPending}
            sx={{ mb: 1.2, bgcolor: 'rgba(34,211,238,0.9)', color: '#06121f', '&:hover': { bgcolor: 'rgb(8,178,210)' } }}
          >
            {run.isPending ? 'Analyserer…' : data ? 'Oppdater innsikt' : 'Lag innsikt'}
          </Button>

          {run.isPending ? <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={20} /></Box> : null}
          {data && data.success === false ? <Alert severity="warning">{data.error}</Alert> : null}

          {data?.success ? (
            <Stack spacing={1.4}>
              {data.summary ? <Typography sx={{ color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.5 }}>{data.summary}</Typography> : null}

              {data.themes && data.themes.length > 0 ? (
                <Box>
                  <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: 'rgba(226,232,240,0.7)', mb: 0.5 }}>Hva folk spør om</Typography>
                  <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                    {data.themes.map((t, i) => (
                      <Chip key={i} size="small" label={`${t.label}${t.count ? ` · ${t.count}` : ''}`} sx={{ bgcolor: 'rgba(34,211,238,0.14)', color: '#a5f3fc', fontWeight: 600 }} />
                    ))}
                  </Stack>
                </Box>
              ) : null}

              {data.contentIdeas && data.contentIdeas.length > 0 ? (
                <Box>
                  <Divider sx={{ mb: 1 }}><Typography sx={{ fontSize: '0.72rem', color: 'rgba(226,232,240,0.5)' }}>Innholdsidéer til markedsplanen</Typography></Divider>
                  <Stack component="ol" spacing={0.5} sx={{ m: 0, pl: 2.2 }}>
                    {data.contentIdeas.map((idea, i) => (
                      <Typography key={i} component="li" sx={{ color: '#e2e8f0', fontSize: '0.86rem', lineHeight: 1.5 }}>{idea}</Typography>
                    ))}
                  </Stack>
                </Box>
              ) : null}

              {data.recommendedActions && data.recommendedActions.length > 0 ? (
                <Box>
                  <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: 'rgba(226,232,240,0.7)', mb: 0.5 }}>Anbefalte neste steg</Typography>
                  <Stack component="ul" spacing={0.4} sx={{ m: 0, pl: 2.2 }}>
                    {data.recommendedActions.map((a, i) => (
                      <Typography key={i} component="li" sx={{ color: '#86efac', fontSize: '0.84rem', lineHeight: 1.5 }}>{a}</Typography>
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          ) : null}
        </Box>
      </Collapse>
    </Box>
  );
}
