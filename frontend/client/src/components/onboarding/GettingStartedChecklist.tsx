// @ts-nocheck
/**
 * GettingStartedChecklist — vedvarende «kom i gang»-sjekkliste på dashboardet.
 *
 * Fire steg som gjør en ny bruker workspace-klar, hver med deep-lenke til rett
 * sted. Status leses fra ekte endepunkter (ingen hardkodet tilstand):
 *   1. Profil komplett   → GET /api/user/profile (.profile.complete)
 *   2. Første prosjekt   → GET /api/projects
 *   3. Team invitert     → GET /api/projects/:id/team/members (første prosjekt)
 *   4. Verktøy koblet    → GET /api/creatorhub/google/status
 *
 * Lukkbar (localStorage) og skjuler seg selv når alle fire er ferdige.
 * Dark CreatorHub-palett (oransje/#fff5e8) for å matche dashboard-hero-en.
 */
import React, { useEffect, useState } from 'react';
import {
  Box, Card, Stack, Typography, IconButton, LinearProgress, Button,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import CheckCircle from '@mui/icons-material/CheckCircle';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import RocketLaunch from '@mui/icons-material/RocketLaunch';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

// Per-bruker-nøkkel: en global nøkkel skjulte sjekklisten for ALLE kontoer på
// samme nettleser og overlevde logg-ut/inn.
const dismissKeyFor = (userId?: string) => `getting-started-dismissed:${userId || 'anon'}`;
const ACCENT = 'var(--ws-accent, #ff8c00)';
const TEXT = '#fff5e8';
const DIM = 'rgba(246,242,234,0.72)';
const FAINT = 'rgba(246,242,234,0.45)';
const GREEN = '#34d399';

interface Props {
  userId?: string;
  profession?: string;
  userEmail?: string;
  /** Nåværende prosjekt (når montert inne i workspace) — brukes til team-sjekk
   *  og team-deep-lenke i stedet for å utlede fra prosjektlista. */
  projectId?: string;
  onNewProject?: () => void;
}

const GettingStartedChecklist: React.FC<Props> = ({ userId, profession, projectId, onNewProject }) => {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissKeyFor(userId)) === '1'; } catch { return false; }
  });
  // Re-les dismiss-flagget hvis brukeren bytter (per-bruker-nøkkel).
  useEffect(() => {
    try { setDismissed(localStorage.getItem(dismissKeyFor(userId)) === '1'); } catch { /* ignore */ }
  }, [userId]);
  const [state, setState] = useState<any>({
    loading: true, profileComplete: false, hasProject: false,
    teamInvited: false, toolsConnected: false, firstProjectId: null, isEnterprise: false,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const prof = await apiRequest('/api/user/profile').catch(() => null);
      // I workspace kjenner vi prosjektet allerede (projectId) — da slipper vi
      // prosjektlista. Utenfor workspace utledes «har prosjekt» fra /api/projects.
      let list: any[] = [];
      if (projectId && projectId !== 'sample') {
        list = [{ id: projectId }];
      } else {
        const projectsRes = await apiRequest(
          `/api/projects?profession=${encodeURIComponent(profession || '')}&userId=${encodeURIComponent(userId || '')}`,
        ).catch(() => null);
        list = Array.isArray(projectsRes) ? projectsRes : (projectsRes?.projects || []);
      }
      const firstProjectId = projectId && projectId !== 'sample' ? projectId : (list[0]?.id || null);
      let teamInvited = false;
      if (firstProjectId) {
        const team = await apiRequest(`/api/projects/${firstProjectId}/team/members`).catch(() => null);
        teamInvited = ((team?.members || []).length > 0);
      }
      const google = await apiRequest('/api/creatorhub/google/status').catch(() => null);
      const toolsConnected = !!(google?.connected || google?.linked || google?.isConnected || google?.status === 'connected');
      // Team er en Enterprise-funksjon. «Inviter team»-steget vises kun for
      // Enterprise-brukere (org-medlemskap eller enterprise-profesjonen) — ikke
      // for individuelle skapere, som ikke kan ha team.
      const membership = await apiRequest('/api/enterprise/my-membership').catch(() => null);
      const isEnterprise = !!(membership?.membership?.organizationId) || profession === 'enterprise';
      if (!alive) return;
      setState({
        loading: false,
        profileComplete: !!(prof?.profile?.complete),
        hasProject: list.length > 0,
        teamInvited,
        toolsConnected,
        firstProjectId,
        isEnterprise,
      });
    })();
    return () => { alive = false; };
  }, [userId, profession]);

  const dismiss = () => {
    try { localStorage.setItem(dismissKeyFor(userId), '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  const items = [
    { key: 'profil', label: 'Fullfør profilen din', desc: 'Navn, profesjon, avatar og firmanavn', done: state.profileComplete,
      cta: 'Åpne profil', onClick: () => navigate('/profil') },
    { key: 'prosjekt', label: 'Lag ditt første prosjekt', desc: 'Kom i gang i Team Workspace', done: state.hasProject,
      cta: 'Nytt prosjekt', onClick: () => (onNewProject ? onNewProject() : navigate('/dashboard')) },
    // Team-steget er Enterprise-gated (team er en Enterprise-funksjon).
    ...(state.isEnterprise ? [{ key: 'team', label: 'Inviter teamet ditt', desc: 'Legg til medarbeidere på et prosjekt', done: state.teamInvited,
      cta: 'Inviter', onClick: () => (state.firstProjectId ? navigate(`/workspace/${state.firstProjectId}/team`) : (onNewProject ? onNewProject() : navigate('/dashboard'))) }] : []),
    { key: 'verktoy', label: 'Koble til verktøyene dine', desc: 'Google Workspace, lagring og backup', done: state.toolsConnected,
      cta: 'Koble til', onClick: () => navigate('/settings') },
  ];
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);

  // Skjul under lasting, når lukket, eller når alt er ferdig.
  if (dismissed || state.loading || doneCount === items.length) return null;

  return (
    <Card sx={{
      mb: { xs: 3, md: 4 }, p: { xs: 2, md: 3 }, borderRadius: 3, boxShadow: 'none',
      border: '1px solid rgba(255,140,0,0.22)',
      background: 'linear-gradient(135deg, rgba(255,140,0,0.12), rgba(255,140,0,0.02))',
      color: TEXT,
    }}>
      <Stack direction="row" alignItems="flex-start" spacing={1.5}>
        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'rgba(255,140,0,0.18)', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <RocketLaunch />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: '"Space Grotesk", sans-serif' }}>Kom i gang</Typography>
            <IconButton size="small" onClick={dismiss} sx={{ color: FAINT }} aria-label="Skjul kom-i-gang">
              <Close fontSize="small" />
            </IconButton>
          </Stack>
          <Typography variant="body2" sx={{ color: DIM, mb: 1.25 }}>
            {doneCount} av {items.length} fullført — gjør deg klar til å bruke workspace.
          </Typography>
          <LinearProgress variant="determinate" value={pct}
            sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.08)', mb: 2, '& .MuiLinearProgress-bar': { bgcolor: ACCENT, borderRadius: 3 } }} />

          <Stack spacing={1}>
            {items.map((it) => (
              <Stack key={it.key} direction="row" alignItems="center" spacing={1.5}
                sx={{ p: 1, borderRadius: 2, bgcolor: it.done ? 'transparent' : 'rgba(255,255,255,0.03)' }}>
                {it.done
                  ? <CheckCircle sx={{ color: GREEN, fontSize: 22, flexShrink: 0 }} />
                  : <RadioButtonUnchecked sx={{ color: FAINT, fontSize: 22, flexShrink: 0 }} />}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: it.done ? DIM : TEXT, textDecoration: it.done ? 'line-through' : 'none' }}>
                    {it.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: FAINT }}>{it.desc}</Typography>
                </Box>
                {!it.done && (
                  <Button size="small" onClick={it.onClick}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 999, px: 1.75, color: ACCENT, border: '1px solid rgba(255,140,0,0.35)', flexShrink: 0, '&:hover': { bgcolor: 'rgba(255,140,0,0.10)', border: '1px solid rgba(255,140,0,0.6)' } }}>
                    {it.cta}
                  </Button>
                )}
              </Stack>
            ))}
          </Stack>
        </Box>
      </Stack>
    </Card>
  );
};

export default GettingStartedChecklist;
