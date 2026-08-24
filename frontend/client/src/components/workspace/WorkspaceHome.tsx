// @ts-nocheck
/**
 * WorkspaceHome — «/workspace»-landing (prosjektvelger).
 *
 * Workspace er hovedflaten. Ved innlogging rutes brukeren hit i stedet for
 * UniversalDashboard. Siden lister brukerens prosjekter (kort → /workspace/:id)
 * med en «nytt prosjekt»-knapp.
 *   - Nøyaktig ett prosjekt → hopp rett inn i det (ingen unødig mellomstopp).
 *   - Ingen prosjekter → tom-tilstand med primær «lag ditt første prosjekt».
 * Dark CreatorHub-skall (workspaceDarkTheme + ws-tokens).
 */
import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Container, Stack, Typography, Button, Card, Grid, Chip, Avatar,
  CircularProgress, IconButton, Dialog, DialogContent, ThemeProvider,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import Logout from '@mui/icons-material/Logout';
import AccountCircle from '@mui/icons-material/AccountCircle';
import FolderOpen from '@mui/icons-material/FolderOpen';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { ws, workspaceDarkTheme, workspaceCategoryFor } from './workspaceTheme';
import { getProfessionDisplayName } from '@shared/profession-types';
import ProjectCreationWithMemoryCards from '../project/ProjectCreationWithMemoryCards';
import GettingStartedChecklist from '../onboarding/GettingStartedChecklist';

const CATEGORY_LABEL = { visual: 'Foto & video', music: 'Musikk', service: 'Tjeneste', vendor: 'Leverandør' };

const WorkspaceHome: React.FC = () => {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  // ?pick=1 lar brukeren nå prosjektvelgeren bevisst uten å bli auto-sendt inn i
  // eneste-prosjektet (ellers uoppnåelig med nøyaktig ett prosjekt).
  const pickMode = typeof window !== 'undefined' && /(?:\?|&)pick=1/.test(window.location.search);
  // ?new=1 — ekstern lenke inn til "opprett prosjekt" (f.eks. Creatorhub One
  // Desk sin "ingen prosjekter"-skjerm) åpner wizarden direkte i stedet for
  // å lande på tomme prosjektlisten.
  const newProjectMode = typeof window !== 'undefined' && /(?:\?|&)new=1/.test(window.location.search);

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(newProjectMode);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const redirected = useRef(false);

  const profession = user?.profession;
  const userId = user?.id;
  const firstName = user?.firstName || (user?.name || '').split(' ')[0] || '';
  const category = workspaceCategoryFor(profession);

  useEffect(() => {
    let alive = true;
    (async () => {
      let errored = false;
      const res = await apiRequest(
        `/api/projects?profession=${encodeURIComponent(profession || '')}&userId=${encodeURIComponent(userId || '')}`,
      ).catch(() => { errored = true; return null; });
      const list = Array.isArray(res) ? res : (res?.projects || []);
      if (!alive) return;
      // Skill nettverks-/auth-feil fra ekte «ingen prosjekter» — ellers ville en
      // transient feil vist tom-tilstand og fristet til duplikat-opprettelse.
      if (errored) { setLoadError(true); setLoading(false); return; }
      // Nøyaktig ett prosjekt → hopp rett inn (replace: ikke stable på historikken,
      // ellers blir Back en felle som umiddelbart redirecter framover igjen).
      if (list.length === 1 && !redirected.current && !pickMode && !newProjectMode) {
        redirected.current = true;
        // startTransition: navigasjonen monterer den lazy-lastede
        // TeamWorkspacePage. Uten transition erstatter det synkront den
        // synlige velgeren mens chunken lastes → React #426 (suspend under
        // synkron input). Transition holder velgeren synlig til den er klar.
        startTransition(() => navigate(`/workspace/${list[0].id}`, { replace: true }));
        return;
      }
      setProjects(list);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId, profession, reloadKey]);

  const openProject = (id: string) => startTransition(() => navigate(`/workspace/${id}`));

  if (loading) return (
    <ThemeProvider theme={workspaceDarkTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: ws.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: ws.accent }} />
      </Box>
    </ThemeProvider>
  );

  if (loadError) return (
    <ThemeProvider theme={workspaceDarkTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: ws.bg, color: ws.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center', px: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Kunne ikke laste prosjektene dine</Typography>
          <Typography variant="body2" sx={{ color: ws.textDim, maxWidth: 380 }}>Noe gikk galt under henting. Sjekk tilkoblingen og prøv igjen.</Typography>
          <Button variant="contained" onClick={() => { setLoadError(false); setLoading(true); redirected.current = false; setReloadKey((k) => k + 1); }}
            sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 700, bgcolor: ws.accent, color: ws.accentContrast, '&:hover': { bgcolor: ws.accentHover } }}>
            Prøv igjen
          </Button>
        </Stack>
      </Box>
    </ThemeProvider>
  );

  return (
    <ThemeProvider theme={workspaceDarkTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: ws.bg, color: ws.text, py: 4 }}>
        <Container maxWidth="lg">
          {/* Header */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: '"Space Grotesk", sans-serif' }}>
                {firstName ? `Hei ${firstName}` : 'Workspace'}
              </Typography>
              <Typography variant="body2" sx={{ color: ws.textDim, mt: 0.5 }}>
                {profession ? [getProfessionDisplayName(profession), CATEGORY_LABEL[category]].filter(Boolean).join(' · ') : 'Velg et prosjekt for å komme i gang'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton onClick={() => navigate('/profil')} sx={{ color: ws.textDim }} aria-label="Min profil"><AccountCircle /></IconButton>
              <IconButton onClick={() => { try { (logout as any)?.(); } catch { window.location.href = '/login'; } }} sx={{ color: ws.textDim }} aria-label="Logg ut"><Logout /></IconButton>
            </Stack>
          </Stack>

          {/* «Kom i gang» — første skjerm etter innlogging. Onboarding-readiness
              (profil/prosjekt/team/verktøy) rett på workspace-hjemmet. */}
          <Box sx={{ mt: 3 }}>
            <GettingStartedChecklist
              userId={userId}
              profession={profession}
              userEmail={user?.email}
              onNewProject={() => setShowCreate(true)}
            />
          </Box>

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 3, mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Dine prosjekter</Typography>
            {projects.length > 0 && (
              <Button variant="contained" startIcon={<Add />} onClick={() => setShowCreate(true)}
                sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 700, bgcolor: ws.accent, color: ws.accentContrast, '&:hover': { bgcolor: ws.accentHover } }}>
                Nytt prosjekt
              </Button>
            )}
          </Stack>

          {projects.length === 0 ? (
            /* Tom-tilstand */
            <Card sx={{ p: 6, textAlign: 'center', bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px`, boxShadow: 'none' }}>
              <Box sx={{ width: 64, height: 64, borderRadius: 3, mx: 'auto', mb: 2, bgcolor: ws.accentSoft, color: ws.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FolderOpen sx={{ fontSize: 32 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Ingen prosjekter ennå</Typography>
              <Typography variant="body2" sx={{ color: ws.textDim, mb: 3, maxWidth: 420, mx: 'auto' }}>
                Lag ditt første prosjekt for å ta i bruk Team Workspace — planlegging, rom, media, team og levering på ett sted.
              </Typography>
              <Button variant="contained" size="large" startIcon={<Add />} onClick={() => setShowCreate(true)}
                sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 700, px: 4, bgcolor: ws.accent, color: ws.accentContrast, '&:hover': { bgcolor: ws.accentHover } }}>
                Lag ditt første prosjekt
              </Button>
            </Card>
          ) : (
            <Grid container spacing={2.5}>
              {projects.map((p) => {
                const title = p.title || p.name || 'Uten tittel';
                const statusRaw = p.status === 'active' ? 'Pågående' : (p.status || '');
                return (
                  <Grid item xs={12} sm={6} md={4} key={p.id}>
                    <Card onClick={() => openProject(p.id)}
                      sx={{ cursor: 'pointer', overflow: 'hidden', bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px`, boxShadow: 'none', transition: 'border-color .15s, transform .15s', '&:hover': { borderColor: ws.accentBorder, transform: 'translateY(-2px)' } }}>
                      <Box sx={{ height: 120, background: p.coverUrl ? `url(${p.coverUrl}) center/cover` : `linear-gradient(135deg, ${ws.accentSoft}, ${ws.panelSolid})`, display: 'flex', alignItems: 'flex-end', p: 1.5 }}>
                        {statusRaw && <Chip label={statusRaw} size="small" sx={{ bgcolor: 'rgba(0,0,0,0.45)', color: ws.text, fontWeight: 700, backdropFilter: 'blur(4px)' }} />}
                      </Box>
                      <Box sx={{ p: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap>{title}</Typography>
                        <Typography variant="caption" sx={{ color: ws.textDim }}>
                          {[p.projectType, p.location].filter(Boolean).join(' · ') || 'Team Workspace'}
                        </Typography>
                      </Box>
                    </Card>
                  </Grid>
                );
              })}
              {/* Nytt prosjekt-kort */}
              <Grid item xs={12} sm={6} md={4}>
                <Card onClick={() => setShowCreate(true)}
                  sx={{ cursor: 'pointer', height: '100%', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, bgcolor: 'transparent', border: `1.5px dashed ${ws.border}`, borderRadius: `${ws.radius}px`, boxShadow: 'none', color: ws.textDim, transition: 'border-color .15s, color .15s', '&:hover': { borderColor: ws.accent, color: ws.accent } }}>
                  <Add sx={{ fontSize: 30 }} />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Nytt prosjekt</Typography>
                </Card>
              </Grid>
            </Grid>
          )}
        </Container>

        {/* Prosjekt-opprettelse — samme wizard som workspace/dashboard */}
        <Dialog open={showCreate} onClose={() => setShowCreate(false)} fullWidth maxWidth="lg">
          <DialogContent dividers sx={{ p: 0 }}>
            {showCreate && (
              <ProjectCreationWithMemoryCards
                profession={(profession as string) || 'photographer'}
                userId={userId}
                onProjectCreated={(p: any) => {
                  setShowCreate(false);
                  if (p?.id) startTransition(() => navigate(`/workspace/${p.id}`));
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
};

export default WorkspaceHome;
