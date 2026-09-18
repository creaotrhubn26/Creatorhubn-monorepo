/**
 * ProjectHomePanel — «Hjem» for spillprosjektet (Fase 7b): KPI-kort, neste
 * opp, milepælstripe, episoder, siste aktivitet og hurtighandlinger. Data fra
 * ett aggregat-endepunkt (GET /overview). Alle states: laster/feil/tom.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';
import { Add as AddIcon, AutoStoriesOutlined as StoryIcon, AutoAwesomeMosaicOutlined as TemplateIcon, DevicesOutlined as PlatformIcon, Refresh as RefreshIcon, TimelineOutlined as PlanIcon } from '@mui/icons-material';
import { applyProjectTemplate, getProjectOverview, NarrativeApiError, type ProjectTemplate } from '../narrativeService';
import type { NarrativeProjectOverview } from '../narrativeTypes';
import { NARRATIVE_LANE_LABELS, NARRATIVE_MILESTONE_STATUS_LABELS, NARRATIVE_SCENE_ERA_LABELS, type NarrativeSceneEra } from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';
import { SCENE_STATUS_COLORS, SCENE_STATUS_LABELS } from '../scenes/sceneOps';
import { homeKpis, isEmptyProject, NEXT_UP_LABELS, NEXT_UP_ORDER, nextUpFromMilestones, sortNextUp, type HomeKpi } from './homeOps';

const TONE_COLOR: Record<HomeKpi['tone'], string> = { accent: narrativeColors.accent, warning: narrativeColors.warning, error: narrativeColors.error, neutral: narrativeColors.textDim };
const MS_STATUS_COLOR = { planned: narrativeColors.textDim, in_progress: '#93a4dc', done: narrativeColors.accent, blocked: narrativeColors.error } as const;

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' }) : '';
}

export interface ProjectHomePanelProps {
  projectId: string;
  projectTitle: string;
  refreshKey?: number;
  onNavigate: (tab: string, extra?: { sceneId?: string }) => void;
}

export function ProjectHomePanel({ projectId, projectTitle, refreshKey = 0, onNavigate }: ProjectHomePanelProps): React.ReactElement {
  // Fase 8g: «Start fra mal» (blank / demo-adventure / wfu-sample) — skrives gjennom service-funksjonene, revisjon «Før mal» først.
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateNotice, setTemplateNotice] = useState<{ text: string; severity: 'success' | 'warning' | 'error' } | null>(null);
  const [overview, setOverview] = useState<NarrativeProjectOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { setOverview(await getProjectOverview(projectId)); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : 'Kunne ikke hente oversikten.'); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const applyTemplate = useCallback(async (template: ProjectTemplate) => {
    setTemplateBusy(true);
    try {
      const r = await applyProjectTemplate(projectId, template);
      const n = r.report ? Object.values(r.report).reduce((acc, c) => acc + c.inserted, 0) : 0;
      setTemplateNotice({ text: template === 'blank' ? 'Tomt prosjekt — begynn med Historie eller en scene.' : `Mal «${template}» lagt inn (${n} rader).`, severity: 'success' });
      setTemplateOpen(false);
      await load();
    } catch (err) {
      const msg = err instanceof NarrativeApiError && err.code === 'plan_limit' ? 'Planen din har nådd grensen for antall Story Graph-prosjekter — oppgrader eller tøm et prosjekt.' : err instanceof Error ? err.message : 'Kunne ikke bruke malen.';
      setTemplateNotice({ text: msg, severity: 'error' });
    } finally { setTemplateBusy(false); }
  }, [projectId, load]);

  const kpis = useMemo(() => (overview ? homeKpis(overview) : []), [overview]);
  const nextUp = useMemo(() => (overview ? sortNextUp(nextUpFromMilestones(overview.milestones)) : []), [overview]);
  const eras = useMemo(() => (overview ? Object.entries(overview.scenes.byEra).sort((a, b) => a[0].localeCompare(b[0])) : []), [overview]);

  if (loading && !overview) {
    return (
      <Box sx={{ p: 3 }} data-testid="narrative-home-loading">
        <Skeleton variant="text" width={280} height={36} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
        <Stack direction="row" spacing={1.5} sx={{ mt: 2, flexWrap: 'wrap' }} useFlexGap>
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} variant="rounded" width={200} height={96} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />)}
        </Stack>
      </Box>
    );
  }
  if (error && !overview) {
    return (
      <Box sx={{ p: 3 }} data-testid="narrative-home-error">
        <Alert severity="error" action={<Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => void load()}>Prøv igjen</Button>}>{error}</Alert>
      </Box>
    );
  }
  if (!overview) return <Box />;

  if (isEmptyProject(overview)) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 820 }} data-testid="narrative-home-empty">
        <TemplateDialog open={templateOpen} busy={templateBusy} onClose={() => setTemplateOpen(false)} onPick={(t) => void applyTemplate(t)} />
        <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{projectTitle}</Typography>
        <Typography sx={{ fontSize: 14, color: narrativeColors.textDim, mt: 1 }}>
          Prosjektet er tomt. Start med historien (episoder og kilder), legg inn scenekort med manusfelt, og sett målplattformen så alle vet hva spillet skal kjøre på.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 3, flexWrap: 'wrap' }} useFlexGap>
          <Button variant="contained" startIcon={<TemplateIcon />} onClick={() => setTemplateOpen(true)} sx={{ bgcolor: narrativeColors.accent, color: '#03150a', fontWeight: 700 }} data-testid="narrative-home-cta-template">Start fra mal</Button>
          <Button variant="outlined" startIcon={<StoryIcon />} onClick={() => onNavigate('story')} sx={{ color: narrativeColors.text, borderColor: narrativeColors.borderSoft }} data-testid="narrative-home-cta-story">Historie</Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => onNavigate('scenes')} sx={{ color: narrativeColors.text, borderColor: narrativeColors.borderSoft }} data-testid="narrative-home-cta-scene">Ny scene</Button>
          <Button variant="outlined" startIcon={<PlatformIcon />} onClick={() => onNavigate('platform')} sx={{ color: narrativeColors.text, borderColor: narrativeColors.borderSoft }} data-testid="narrative-home-cta-platform">Plattform</Button>
        </Stack>
        {templateNotice ? <Alert severity={templateNotice.severity} sx={{ mt: 2 }} data-testid="narrative-home-template-notice" onClose={() => setTemplateNotice(null)}>{templateNotice.text}</Alert> : null}
        <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, mt: 3 }}>
          Har studioet et manus-uttrekk? Seed prosjektet fra kommandolinjen: <code>npm run seed:story-graph -- --project {projectId}</code>
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400 }} data-testid="narrative-home">
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Typography sx={{ fontSize: 22, fontWeight: 800, flex: 1 }} data-testid="narrative-home-title">{projectTitle}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => onNavigate('scenes')} sx={{ color: narrativeColors.accent }} data-testid="narrative-home-new-scene">Ny scene</Button>
        <Button size="small" startIcon={<PlanIcon />} onClick={() => onNavigate('plan')} sx={{ color: narrativeColors.textDim }}>Produksjonsplan</Button>
        <Button size="small" startIcon={<RefreshIcon />} onClick={() => void load()} sx={{ color: narrativeColors.textDim }} aria-label="Oppdater">Oppdater</Button>
      </Stack>
      {error ? <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert> : null}
      {templateNotice ? <Alert severity={templateNotice.severity} sx={{ mb: 2 }} data-testid="narrative-home-template-notice" onClose={() => setTemplateNotice(null)}>{templateNotice.text}</Alert> : null}

      {/* KPI-kort */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 1.5 }}>
        {kpis.map((k) => (
          <Card key={k.key} sx={{ bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}`, color: narrativeColors.text }} data-testid={`narrative-home-kpi-${k.key}`}>
            <CardActionArea onClick={() => onNavigate(k.tab)} sx={{ height: '100%' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography sx={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: narrativeColors.textDim, fontWeight: 700 }}>{k.label}</Typography>
                <Typography sx={{ fontSize: 26, fontWeight: 800, color: TONE_COLOR[k.tone], lineHeight: 1.2 }}>{k.value}</Typography>
                <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, mt: 0.25 }}>{k.sub}</Typography>
                {k.pct !== null ? <LinearProgress variant="determinate" value={k.pct} sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: TONE_COLOR[k.tone] } }} /> : null}
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.3fr 1fr' }, gap: 2, mt: 2 }}>
        {/* Venstre: status per scene, epoker, episoder */}
        <Stack spacing={2}>
          <Card sx={{ bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}`, color: narrativeColors.text }}>
            <CardContent>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>Scener per status</Typography>
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }} useFlexGap>
                {(Object.keys(SCENE_STATUS_LABELS) as Array<keyof typeof SCENE_STATUS_LABELS>).map((st) => (
                  <Chip key={st} size="small" label={`${SCENE_STATUS_LABELS[st]} ${overview.scenes.byStatus[st] ?? 0}`} onClick={() => onNavigate('scenes')} sx={{ bgcolor: `${SCENE_STATUS_COLORS[st]}22`, color: SCENE_STATUS_COLORS[st], fontWeight: 700 }} data-testid={`narrative-home-status-${st}`} />
                ))}
              </Stack>
              {eras.length ? (
                <Stack direction="row" spacing={0.75} sx={{ mt: 1.5, flexWrap: 'wrap' }} useFlexGap>
                  {eras.map(([era, n]) => <Chip key={era} size="small" variant="outlined" label={`${NARRATIVE_SCENE_ERA_LABELS[era as NarrativeSceneEra] ?? era} · ${n}`} sx={{ color: narrativeColors.textDim, borderColor: narrativeColors.borderSoft }} />)}
                </Stack>
              ) : null}
            </CardContent>
          </Card>

          <Card sx={{ bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}`, color: narrativeColors.text }}>
            <CardContent>
              <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, flex: 1 }}>Episoder</Typography>
                <Button size="small" onClick={() => onNavigate('story')} sx={{ color: narrativeColors.accent, fontSize: 11 }}>Åpne Historie</Button>
              </Stack>
              {overview.episodes.length === 0 ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen episoder ennå.</Typography> : (
                <Stack spacing={0.75}>
                  {overview.episodes.map((e) => (
                    <Stack key={e.id} direction="row" alignItems="center" spacing={1} data-testid={`narrative-home-episode-${e.code}`}>
                      <Chip size="small" label={e.code} sx={{ height: 20, fontSize: 10, fontWeight: 800, bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent }} />
                      <Typography sx={{ fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</Typography>
                      <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, whiteSpace: 'nowrap' }}>{e.approvedCount}/{e.sceneCount} scener godkjent</Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>

        {/* Høyre: neste opp, milepæler, aktivitet */}
        <Stack spacing={2}>
          <Card sx={{ bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}`, color: narrativeColors.text }} data-testid="narrative-home-next-up">
            <CardContent>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>Neste opp</Typography>
              {nextUp.length === 0 && !overview.tasks.overdue && !overview.reviews.open ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingenting haster. Neste milepæl er mer enn to uker unna.</Typography> : null}
              <Stack spacing={0.75}>
                {overview.reviews.open ? (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => onNavigate('scenes')}>
                    <Chip size="small" label="Review" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(147, 164, 220,0.15)', color: '#93a4dc', fontWeight: 700 }} />
                    <Typography sx={{ fontSize: 13 }}>{overview.reviews.open} åpen{overview.reviews.open === 1 ? '' : 'ne'} runde{overview.reviews.open === 1 ? '' : 'r'} venter på beslutning</Typography>
                  </Stack>
                ) : null}
                {overview.tasks.overdue ? (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => onNavigate('scenes')}>
                    <Chip size="small" label="Forfalt" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(248,113,113,0.15)', color: narrativeColors.error, fontWeight: 700 }} />
                    <Typography sx={{ fontSize: 13 }}>{overview.tasks.overdue} forfalt{overview.tasks.overdue === 1 ? '' : 'e'} oppgave{overview.tasks.overdue === 1 ? '' : 'r'}</Typography>
                  </Stack>
                ) : null}
                {NEXT_UP_ORDER.flatMap((bucket) => nextUp.filter((i) => i.bucket === bucket).map((i) => (
                  <Stack key={i.key} direction="row" spacing={1} alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => onNavigate(i.tab)} data-testid={`narrative-home-next-${i.kind}`}>
                    <Chip size="small" label={NEXT_UP_LABELS[bucket]} sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: bucket === 'urgent' ? 'rgba(248,113,113,0.15)' : 'rgba(245,158,11,0.15)', color: bucket === 'urgent' ? narrativeColors.error : narrativeColors.warning }} />
                    <Typography sx={{ fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</Typography>
                    <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>{when(i.at)}</Typography>
                  </Stack>
                )))}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}`, color: narrativeColors.text }} data-testid="narrative-home-milestones">
            <CardContent>
              <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, flex: 1 }}>Milepæler</Typography>
                <Button size="small" onClick={() => onNavigate('plan')} sx={{ color: narrativeColors.accent, fontSize: 11 }}>Åpne plan</Button>
              </Stack>
              {overview.milestones.length === 0 ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen milepæler ennå.</Typography> : (
                <Stack spacing={0.5}>
                  {overview.milestones.slice(0, 6).map((m) => (
                    <Stack key={m.id} direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: MS_STATUS_COLOR[m.status], flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</Typography>
                      <Typography sx={{ fontSize: 10, color: narrativeColors.textDim, whiteSpace: 'nowrap' }}>{NARRATIVE_LANE_LABELS[m.lane]} · {NARRATIVE_MILESTONE_STATUS_LABELS[m.status]}{m.dueAt ? ` · ${when(m.dueAt)}` : ''}</Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card sx={{ bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}`, color: narrativeColors.text }} data-testid="narrative-home-activity">
            <CardContent>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>Siste aktivitet</Typography>
              {overview.activity.length === 0 ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen aktivitet ennå.</Typography> : (
                <Stack spacing={0.5}>
                  {overview.activity.slice(0, 10).map((a) => (
                    <Stack key={`${a.kind}:${a.id}`} direction="row" spacing={1} alignItems="baseline" sx={{ cursor: a.sceneId ? 'pointer' : 'default' }} onClick={() => { if (a.sceneId) onNavigate('scenes', { sceneId: a.sceneId }); }}>
                      <Typography sx={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>{a.title}</b> <span style={{ color: narrativeColors.textDim }}>· {a.detail}</span></Typography>
                      <Typography sx={{ fontSize: 10, color: narrativeColors.textDim, whiteSpace: 'nowrap' }}>{when(a.at)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
}

export default ProjectHomePanel;

const TEMPLATES: Array<{ id: ProjectTemplate; title: string; body: string }> = [
  { id: 'blank', title: 'Tomt', body: 'Bare skallet. Du legger inn historie, scener og plattform selv.' },
  { id: 'demo-adventure', title: 'Demo-eventyr', body: '«Lykten i Dalen»: 1 episode, 6 scener, 4 karakterer, 2 lokasjoner — uten IP, fritt å endre.' },
  { id: 'wfu-sample', title: 'WFU-utdrag', body: 'Tre scenekort fra What Follows Us (uten replikker) som viser Før/Handling/Kontroll/Etter/Lyd, kildemerker og epoke.' },
];

function TemplateDialog({ open, busy, onClose, onPick }: { open: boolean; busy: boolean; onClose: () => void; onPick: (t: ProjectTemplate) => void }): React.ReactElement {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` }, 'data-testid': 'narrative-template-dialog' } as never}>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>Start fra mal</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, mb: 1.5 }}>Malen skrives gjennom de vanlige funksjonene og tas en revisjon av først — ingenting overskrives.</Typography>
        <Stack spacing={1}>
          {TEMPLATES.map((t) => (
            <Card key={t.id} sx={{ bgcolor: 'transparent', border: `1px solid ${narrativeColors.borderSoft}` }} data-testid={`narrative-template-${t.id}`}>
              <CardActionArea disabled={busy} onClick={() => onPick(t.id)}>
                <CardContent sx={{ py: 1.25 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{t.title}</Typography>
                  <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>{t.body}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={busy} sx={{ color: narrativeColors.textDim }}>{busy ? 'Legger inn…' : 'Avbryt'}</Button></DialogActions>
    </Dialog>
  );
}
