/**
 * PostAgentReadyCard — surfaces "is this project ready for Post Agent?" status
 * inside the Role Room dashboard. Shows scene-count, equipment-count, captured-
 * clips and active team-seats so the production lead can see at a glance what
 * the Tauri desktop app will find when it pairs.
 *
 * Only rendered when the active profession is 'production' (film/video) — for
 * weddings/portraits the Post Agent flow is out of scope.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Button,
  Stack,
  Divider,
  Collapse,
} from '@mui/material';
import {
  AutoFixHigh as PostAgentIcon,
  OpenInNew as OpenInNewIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { apiRequest } from '../../../lib/queryClient';
import { BillingOverviewDialog } from './BillingOverviewDialog';

interface Props {
  projectId: string;
}

const ACCENT = '#a030c0';

function useScenesCount(projectId: string) {
  return useQuery<{ count: number }>({
    queryKey: ['post-agent-card', projectId, 'scenes'],
    queryFn: async () => {
      const res = await apiRequest(`/api/role-room/projects/${projectId}`).catch(() => null);
      const project = (res as any)?.json ? await (res as any).json() : res;
      const scenes = project?.castingScenes || project?.scenes || [];
      return { count: Array.isArray(scenes) ? scenes.length : 0 };
    },
    enabled: !!projectId,
    staleTime: 30_000,
    retry: 1,
  });
}

function useEquipmentCount(projectId: string) {
  return useQuery<{ count: number; cameras: number }>({
    queryKey: ['post-agent-card', projectId, 'equipment'],
    queryFn: async () => {
      const res = await apiRequest(`/api/role-room/projects/${projectId}/equipment`).catch(() => null);
      const data = (res as any)?.json ? await (res as any).json() : res;
      const equipment = Array.isArray(data?.equipment) ? data.equipment : [];
      const cameras = equipment.filter((e: any) =>
        ((e?.category || '') as string).toLowerCase().match(/camera|kamera/),
      );
      return { count: equipment.length, cameras: cameras.length };
    },
    enabled: !!projectId,
    staleTime: 30_000,
    retry: 1,
  });
}

function useTakesCount(projectId: string) {
  return useQuery<{ count: number; circled: number }>({
    queryKey: ['post-agent-card', projectId, 'takes'],
    queryFn: async () => {
      const res = await apiRequest(`/api/role-room/projects/${projectId}/takes`).catch(() => null);
      const data = (res as any)?.json ? await (res as any).json() : res;
      const takes = Array.isArray(data?.takes) ? data.takes : Array.isArray(data) ? data : [];
      const circled = takes.filter((t: any) => t?.markedCircled || t?.marked_circled).length;
      return { count: takes.length, circled };
    },
    enabled: !!projectId,
    staleTime: 30_000,
    retry: 1,
  });
}

function useTeamSeats(projectId: string) {
  return useQuery<{ count: number; configured: boolean }>({
    queryKey: ['post-agent-card', projectId, 'seats'],
    queryFn: async () => {
      const res = await apiRequest(`/api/post-agent/team/${projectId}/seats`).catch(() => null);
      const data = (res as any)?.json ? await (res as any).json() : res;
      const seats = Array.isArray(data?.seats) ? data.seats : [];
      const active = seats.filter((s: any) => s?.isActive !== false);
      return { count: active.length, configured: true };
    },
    enabled: !!projectId,
    staleTime: 30_000,
    retry: 1,
  });
}

function StatusRow({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75 }}>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
      </Box>
      {value}
    </Box>
  );
}

export const PostAgentReadyCard: React.FC<Props> = ({ projectId }) => {
  const [howOpen, setHowOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const scenes = useScenesCount(projectId);
  const equipment = useEquipmentCount(projectId);
  const takes = useTakesCount(projectId);
  const seats = useTeamSeats(projectId);

  const allReady =
    (scenes.data?.count || 0) > 0 &&
    (equipment.data?.count || 0) > 0 &&
    (seats.data?.count || 0) > 0;

  function ChipValue({ n, ok }: { n: number; ok: boolean }) {
    return (
      <Chip
        size="small"
        label={n}
        sx={{
          fontWeight: 700,
          minWidth: 44,
          bgcolor: ok ? 'rgba(74, 212, 138, 0.15)' : 'rgba(184, 168, 216, 0.12)',
          color: ok ? '#4ad48a' : 'text.secondary',
        }}
      />
    );
  }

  return (
    <Card
      sx={{
        mt: 2,
        background: `linear-gradient(135deg, rgba(160, 48, 192, 0.08) 0%, rgba(110, 63, 199, 0.03) 100%)`,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: ACCENT,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PostAgentIcon fontSize="small" />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Post Agent {allReady ? '· klar' : '· trenger oppsett'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Dataene Tauri-appen leser når den parer mot dette prosjektet
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 1 }} />

        <StatusRow
          label="Scener"
          hint="→ pre-genererte bins i Resolve"
          value={
            <ChipValue
              n={scenes.data?.count || 0}
              ok={(scenes.data?.count || 0) > 0}
            />
          }
        />
        <StatusRow
          label="Utstyr"
          hint={
            equipment.data?.cameras
              ? `${equipment.data.cameras} kamera → oppløsning/fps auto-konfig`
              : '→ oppløsning/fps auto-konfig'
          }
          value={
            <ChipValue
              n={equipment.data?.count || 0}
              ok={(equipment.data?.count || 0) > 0}
            />
          }
        />
        <StatusRow
          label="Klipp fanget"
          hint={
            takes.data?.circled
              ? `${takes.data.circled} circled → prioritert i ingest`
              : 'fra Live Set → ingest med scene-metadata'
          }
          value={
            <ChipValue
              n={takes.data?.count || 0}
              ok={(takes.data?.count || 0) > 0}
            />
          }
        />
        <StatusRow
          label="Crew-seats"
          hint={
            (seats.data?.count || 0) > 0
              ? 'aktive Post Agent-tilganger'
              : 'ingen crew har tilgang — legg til via marketplace'
          }
          value={
            <ChipValue
              n={seats.data?.count || 0}
              ok={(seats.data?.count || 0) > 0}
            />
          }
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<OpenInNewIcon fontSize="small" />}
            href={`/marketplace/post-agent?productionId=${encodeURIComponent(projectId)}`}
            sx={{
              bgcolor: ACCENT,
              '&:hover': { bgcolor: '#b94dd6' },
              flex: 1,
            }}
          >
            {(seats.data?.count || 0) > 0 ? 'Administrer crew-tilgang' : 'Aktiver Post Agent'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            href="/link"
            target="_blank"
            sx={{ borderColor: 'divider', color: 'text.primary', flex: 1 }}
          >
            Par desktop-app
          </Button>
        </Stack>

        <Button
          size="small"
          onClick={() => setBillingOpen(true)}
          sx={{ mt: 1, textTransform: 'none', color: 'text.secondary', justifyContent: 'flex-start', px: 0 }}
        >
          Mine abonnementer →
        </Button>
        <BillingOverviewDialog open={billingOpen} onClose={() => setBillingOpen(false)} />

        <Button
          size="small"
          onClick={() => setHowOpen((v) => !v)}
          endIcon={howOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{
            mt: 1.5,
            textTransform: 'none',
            color: 'text.secondary',
            justifyContent: 'flex-start',
            px: 0,
          }}
        >
          {howOpen ? 'Skjul forklaring' : 'Hvordan fungerer Post Agent?'}
        </Button>
        <Collapse in={howOpen} unmountOnExit>
          <Box sx={{ mt: 1, pl: 1.5, borderLeft: `2px solid ${ACCENT}` }}>
            <Typography variant="caption" component="div" sx={{ mb: 1.25, color: 'text.secondary' }}>
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>1. Konfigurer prosjektet</Box>
              <br />Legg til scener, utstyr og crew her i Role Room — Post Agent leser dette automatisk.
            </Typography>
            <Typography variant="caption" component="div" sx={{ mb: 1.25, color: 'text.secondary' }}>
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>2. Aktiver tilgang</Box>
              <br />Du betaler 299 NOK/seat/mnd for hvert crew-medlem du gir Post Agent-tilgang. Stripe pro-ratar når du legger til eller fjerner medlemmer.
            </Typography>
            <Typography variant="caption" component="div" sx={{ mb: 1.25, color: 'text.secondary' }}>
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>3. Par desktop-appen</Box>
              <br />Crew-medlemmet installerer Post Agent på Mac-en sin og parer med Role Room-kontoen sin. Appen ser umiddelbart prosjektets scener, utstyr og fangede klipp.
            </Typography>
            <Typography variant="caption" component="div" sx={{ mb: 1.25, color: 'text.secondary' }}>
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>4. AI-post-produksjon i Resolve</Box>
              <br />Post Agent pre-genererer bins per scene, auto-konfigurerer Resolve etter kamera-utstyret, og kjører Claude Vision-cull + beat-sync på fangede klipp — alt lokalt på Mac-en, ingen filer forlater maskinen.
            </Typography>
            <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>5. Live Set-handoff</Box>
              <br />Når Live Set fanger klipp under shoot, dukker de opp i Post Agent med scene-metadata intakt — klare for ingest med ett klikk.
            </Typography>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default PostAgentReadyCard;
