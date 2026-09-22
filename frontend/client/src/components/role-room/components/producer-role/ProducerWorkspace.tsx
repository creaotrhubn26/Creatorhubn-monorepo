import { useMemo, type ElementType } from 'react';
import {
  AccountBalanceWalletOutlined as EconomyIcon,
  ArrowForward as ArrowForwardIcon,
  CalendarMonthOutlined as ScheduleIcon,
  FactCheckOutlined as ReviewsIcon,
  GroupsOutlined as CrewIcon,
  HowToRegOutlined as CastingIcon,
  LocationOnOutlined as LocationsIcon,
  SpaceDashboardOutlined as FullWorkspaceIcon,
} from '@mui/icons-material';
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { CastingProject } from '../../models/casting';
import { MOBILE_TOUCH_TARGET_SIZE, TOUCH_TARGET_SIZE, focusVisibleStyles } from '../../constants/accessibility';
import { roleTokens } from '../../theme/roleTokens';
import { useScreenTier } from '../production/useScreenTier';
import { buildProducerWorkspaceBrief, type ProducerWorkspaceTarget } from './producerWorkspaceModel';

interface ProducerWorkspaceProps {
  project: CastingProject;
  readOnly?: boolean;
  canViewEconomy?: boolean;
  onNavigate: (target: ProducerWorkspaceTarget) => void;
  onOpenFullWorkspace: () => void;
}

const TARGETS: ReadonlyArray<{ target: ProducerWorkspaceTarget; label: string; icon: ElementType }> = [
  { target: 'casting', label: 'Casting', icon: CastingIcon },
  { target: 'schedule', label: 'Produksjonsplan', icon: ScheduleIcon },
  { target: 'crew', label: 'Crew', icon: CrewIcon },
  { target: 'locations', label: 'Lokasjoner', icon: LocationsIcon },
  { target: 'economy', label: 'Økonomi', icon: EconomyIcon },
  { target: 'reviews', label: 'Godkjenning', icon: ReviewsIcon },
];

const TONES = {
  attention: { color: '#fcd34d', background: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.26)' },
  active: { color: '#93a4dc', background: 'rgba(93,118,203,.08)', border: 'rgba(93,118,203,.24)' },
  ready: { color: '#6ee7b7', background: 'rgba(16,185,129,.08)', border: 'rgba(16,185,129,.24)' },
  neutral: { color: roleTokens.textMuted, background: 'rgba(148,163,184,.06)', border: 'rgba(148,163,184,.18)' },
} as const;

export function ProducerWorkspace({ project, readOnly = false, canViewEconomy = false, onNavigate, onOpenFullWorkspace }: ProducerWorkspaceProps) {
  const { isMobile } = useScreenTier();
  const targetSize = isMobile ? MOBILE_TOUCH_TARGET_SIZE : TOUCH_TARGET_SIZE;
  const brief = useMemo(() => buildProducerWorkspaceBrief(project), [project]);
  const visibleTargets = TARGETS.filter((item) => item.target !== 'economy' || canViewEconomy);
  const visibleActions = brief.actions.filter((item) => item.target !== 'economy' || canViewEconomy);

  return (
    <Box component="section" aria-labelledby="producer-workspace-title" data-testid="producer-workspace" sx={{ minHeight: '100%', overflowY: 'auto', bgcolor: '#090d14', color: roleTokens.text, p: { xs: 1.5, sm: 2, lg: 3 } }}>
      <Box sx={{ width: '100%', maxWidth: 1540, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5, mb: 2 }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: .5, flexWrap: 'wrap' }}>
              <Chip label="PRODUSENTROM" size="small" sx={{ height: 24, color: '#dfe4f3', bgcolor: 'rgba(93,118,203,.13)', border: '1px solid rgba(93,118,203,.28)', fontWeight: 800, letterSpacing: .7 }} />
              {readOnly ? <Chip label="Skrivebeskyttet" size="small" variant="outlined" /> : null}
            </Stack>
            <Typography id="producer-workspace-title" component="h1" sx={{ fontSize: { xs: '1.45rem', md: '1.9rem' }, fontWeight: 780 }}>{project.name}</Typography>
            <Typography sx={{ color: roleTokens.textMuted, mt: .25, maxWidth: 780 }}>
              Beslutninger, risiko og produksjonsgrunnlag samlet fra prosjektets faktiske data.
            </Typography>
          </Box>
          <Button variant="outlined" startIcon={<FullWorkspaceIcon />} onClick={onOpenFullWorkspace} data-testid="producer-open-full-workspace" sx={{ minHeight: targetSize, color: roleTokens.text, borderColor: roleTokens.border, alignSelf: { xs: 'stretch', md: 'center' }, ...focusVisibleStyles }}>
            Hele prosjektet
          </Button>
        </Box>

        <Box component="nav" aria-label="Produsentens arbeidsflater" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: `repeat(${visibleTargets.length}, minmax(0, 1fr))` }, gap: 1, p: 1, mb: 2.5, border: `1px solid ${roleTokens.border}`, bgcolor: 'rgba(14,18,30,.92)', borderRadius: 2 }}>
          {visibleTargets.map(({ target, label, icon: Icon }) => (
            <Button key={target} startIcon={<Icon sx={{ fontSize: 19 }} />} onClick={() => onNavigate(target)} data-testid={`producer-target-${target}`} sx={{ minHeight: targetSize, justifyContent: 'flex-start', px: 1.5, color: '#dfe4f3', border: '1px solid transparent', '&:hover': { bgcolor: 'rgba(93,118,203,.12)', borderColor: 'rgba(93,118,203,.25)' }, ...focusVisibleStyles }}>
              {label}
            </Button>
          ))}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.55fr) minmax(320px, .7fr)' }, gap: 2 }}>
          <Box>
            <Typography component="h2" sx={{ fontSize: '1.08rem', fontWeight: 760, mb: .25 }}>Prosjektpuls</Typography>
            <Typography sx={{ color: roleTokens.textMuted, fontSize: '.82rem', mb: 1.25 }}>Hvert kort viser datagrunnlaget bak statusen.</Typography>
            <Stack spacing={1.25}>
              {visibleActions.map((action) => {
                const tone = TONES[action.tone];
                return (
                  <Card key={action.id} variant="outlined" data-testid={`producer-action-${action.id}`} sx={{ bgcolor: tone.background, borderColor: tone.border, color: roleTokens.text }}>
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                      <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Chip label={action.evidence} size="small" sx={{ height: 22, mb: .75, color: tone.color, bgcolor: 'rgba(0,0,0,.18)', fontSize: '.68rem' }} />
                          <Typography component="h3" sx={{ fontSize: '.98rem', fontWeight: 740 }}>{action.title}</Typography>
                          <Typography sx={{ mt: .35, color: roleTokens.textMuted, fontSize: '.82rem', lineHeight: 1.5 }}>{action.description}</Typography>
                        </Box>
                        <Button endIcon={<ArrowForwardIcon />} onClick={() => onNavigate(action.target)} sx={{ minHeight: targetSize, flexShrink: 0, color: tone.color, justifyContent: { xs: 'space-between', sm: 'center' }, ...focusVisibleStyles }}>Åpne</Button>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Box>

          <Box>
            <Typography component="h2" sx={{ fontSize: '1.08rem', fontWeight: 760, mb: 1.25 }}>Produksjonsstatus</Typography>
            <Card variant="outlined" sx={{ bgcolor: roleTokens.surface, borderColor: roleTokens.border, color: roleTokens.text }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                  {[
                    { label: 'Opptaksdager', value: brief.stats.productionDayCount },
                    { label: 'Kommende dager', value: brief.stats.upcomingProductionDayCount },
                    { label: 'Crew bekreftet', value: `${brief.stats.confirmedCrewCount}/${brief.stats.crewCount}` },
                    { label: 'Lokasjoner', value: brief.stats.locationCount },
                    { label: 'Castingroller', value: brief.stats.roleCount },
                    { label: 'Valgt cast', value: brief.stats.selectedCandidateCount },
                  ].map((stat) => (
                    <Box key={stat.label} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.06)' }}>
                      <Typography sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' }, fontWeight: 780 }}>{stat.value}</Typography>
                      <Typography sx={{ color: roleTokens.textMuted, fontSize: '.72rem' }}>{stat.label}</Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default ProducerWorkspace;
