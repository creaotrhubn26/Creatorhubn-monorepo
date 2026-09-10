import { useMemo, type ElementType } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  CalendarMonth as CalendarIcon,
  CheckCircleOutline as ReadyIcon,
  ContentCut as PostIcon,
  EventAvailable as TodayIcon,
  FactCheckOutlined as EvidenceIcon,
  GroupsOutlined as CastingIcon,
  MovieCreationOutlined as SceneIcon,
  SpaceDashboardOutlined as FullWorkspaceIcon,
  VideocamOutlined as OnSetIcon,
  ViewQuiltOutlined as VisualPlanIcon,
} from '@mui/icons-material';
import type { Candidate, CastingProject, Role, Schedule } from '../../models/casting';
import { MOBILE_TOUCH_TARGET_SIZE, TOUCH_TARGET_SIZE, focusVisibleStyles } from '../../constants/accessibility';
import { roleTokens } from '../../theme/roleTokens';
import { useScreenTier } from '../production/useScreenTier';
import {
  buildDirectorBrief,
  type DirectorBriefTone,
  type DirectorSurface,
} from './directorWorkspaceModel';

interface DirectorWorkspaceProps {
  project: CastingProject;
  roles: Role[];
  candidates: Candidate[];
  schedules: Schedule[];
  activeSurface?: DirectorSurface;
  readOnly?: boolean;
  onNavigate: (surface: DirectorSurface) => void;
  onOpenFullWorkspace: () => void;
}

const SURFACES: ReadonlyArray<{
  value: DirectorSurface;
  label: string;
  icon: ElementType;
}> = [
  { value: 'today', label: 'I dag', icon: TodayIcon },
  { value: 'scenes', label: 'Scener', icon: SceneIcon },
  { value: 'casting', label: 'Casting', icon: CastingIcon },
  { value: 'visual-plan', label: 'Visuell plan', icon: VisualPlanIcon },
  { value: 'on-set', label: 'På sett', icon: OnSetIcon },
  { value: 'post', label: 'Etterarbeid', icon: PostIcon },
];

const TONE_STYLES: Record<DirectorBriefTone, { color: string; background: string; border: string }> = {
  attention: { color: '#fcd34d', background: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.26)' },
  upcoming: { color: '#7dd3fc', background: 'rgba(14, 165, 233, 0.08)', border: 'rgba(56, 189, 248, 0.24)' },
  ready: { color: '#6ee7b7', background: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.24)' },
  neutral: { color: roleTokens.textMuted, background: 'rgba(148, 163, 184, 0.06)', border: 'rgba(148, 163, 184, 0.18)' },
};

function formatProjectTime(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('nb-NO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function DirectorWorkspace({
  project,
  roles,
  candidates,
  schedules,
  activeSurface = 'today',
  readOnly = false,
  onNavigate,
  onOpenFullWorkspace,
}: DirectorWorkspaceProps) {
  const { isMobile } = useScreenTier();
  const brief = useMemo(
    () => buildDirectorBrief({ project, roles, candidates, schedules }),
    [candidates, project, roles, schedules],
  );
  const updatedLabel = formatProjectTime(brief.projectUpdatedAt);
  const targetSize = isMobile ? MOBILE_TOUCH_TARGET_SIZE : TOUCH_TARGET_SIZE;

  return (
    <Box
      component="section"
      aria-labelledby="director-workspace-title"
      data-testid="director-workspace"
      sx={{
        minHeight: '100%',
        overflowY: 'auto',
        bgcolor: '#090d14',
        color: roleTokens.text,
        p: { xs: 1.5, sm: 2, lg: 3 },
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 1540, mx: 'auto' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 1.5,
            mb: 2,
          }}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap' }}>
              <Chip
                label="REGISSØRROM"
                size="small"
                sx={{
                  height: 24,
                  color: '#d8b4fe',
                  bgcolor: 'rgba(168, 85, 247, 0.13)',
                  border: '1px solid rgba(168, 85, 247, 0.28)',
                  fontWeight: 800,
                  letterSpacing: 0.7,
                }}
              />
              {readOnly ? <Chip label="Skrivebeskyttet" size="small" variant="outlined" /> : null}
            </Stack>
            <Typography id="director-workspace-title" component="h1" sx={{ fontSize: { xs: '1.45rem', md: '1.9rem' }, fontWeight: 780 }}>
              {project.name}
            </Typography>
            <Typography sx={{ color: roleTokens.textMuted, mt: 0.25, maxWidth: 720 }}>
              Det viktigste akkurat nå, samlet fra prosjektets registrerte manus-, casting- og produksjonsdata.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<FullWorkspaceIcon />}
            onClick={onOpenFullWorkspace}
            data-testid="director-open-full-workspace"
            sx={{
              minHeight: targetSize,
              color: roleTokens.text,
              borderColor: roleTokens.border,
              alignSelf: { xs: 'stretch', md: 'center' },
              ...focusVisibleStyles,
            }}
          >
            Hele prosjektet
          </Button>
        </Box>

        <Box
          component="nav"
          aria-label="Regissørens arbeidsflater"
          data-testid="director-surface-nav"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' },
            gap: 1,
            p: 1,
            mb: 2.5,
            border: `1px solid ${roleTokens.border}`,
            bgcolor: 'rgba(14, 18, 30, 0.92)',
            borderRadius: 2,
          }}
        >
          {SURFACES.map(({ value, label, icon: Icon }) => {
            const selected = value === activeSurface;
            return (
              <Button
                key={value}
                onClick={() => onNavigate(value)}
                startIcon={<Icon sx={{ fontSize: 19 }} />}
                aria-current={selected ? 'page' : undefined}
                data-testid={`director-surface-${value}`}
                sx={{
                  minHeight: targetSize,
                  justifyContent: 'flex-start',
                  px: 1.5,
                  color: selected ? '#fff' : roleTokens.textMuted,
                  bgcolor: selected ? 'rgba(184, 107, 255, 0.18)' : 'transparent',
                  border: selected ? '1px solid rgba(184, 107, 255, 0.36)' : '1px solid transparent',
                  '&:hover': { bgcolor: selected ? 'rgba(184, 107, 255, 0.24)' : 'rgba(255,255,255,0.05)' },
                  ...focusVisibleStyles,
                }}
              >
                {label}
              </Button>
            );
          })}
        </Box>

        <Box
          data-testid="director-today"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.6fr) minmax(320px, 0.7fr)' },
            gap: 2,
          }}
        >
          <Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1} sx={{ mb: 1.25 }}>
              <Box>
                <Typography component="h2" sx={{ fontSize: '1.08rem', fontWeight: 760 }}>
                  Beslutninger og avklaringer
                </Typography>
                <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.82rem' }}>
                  Kortene forklarer alltid hvilke prosjektdata de bygger på.
                </Typography>
              </Box>
              <Chip
                icon={<EvidenceIcon sx={{ color: '#6ee7b7 !important' }} />}
                label="Ingen AI-antakelser"
                size="small"
                sx={{ color: '#a7f3d0', bgcolor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
              />
            </Stack>

            <Stack spacing={1.25}>
              {brief.items.map((item) => {
                const tone = TONE_STYLES[item.tone];
                return (
                  <Card
                    key={item.id}
                    variant="outlined"
                    data-testid={`director-action-${item.id}`}
                    sx={{ bgcolor: tone.background, borderColor: tone.border, color: roleTokens.text }}
                  >
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                      <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Chip
                            label={item.sourceLabel}
                            size="small"
                            sx={{ height: 22, mb: 0.75, color: tone.color, bgcolor: 'rgba(0,0,0,0.18)', fontSize: '0.68rem' }}
                          />
                          <Typography component="h3" sx={{ fontSize: '0.98rem', fontWeight: 740 }}>
                            {item.title}
                          </Typography>
                          <Typography sx={{ mt: 0.35, color: roleTokens.textMuted, fontSize: '0.82rem', lineHeight: 1.5 }}>
                            {item.description}
                          </Typography>
                        </Box>
                        <Button
                          endIcon={<ArrowForwardIcon />}
                          onClick={() => onNavigate(item.target)}
                          sx={{
                            minHeight: targetSize,
                            flexShrink: 0,
                            color: tone.color,
                            justifyContent: { xs: 'space-between', sm: 'center' },
                            ...focusVisibleStyles,
                          }}
                        >
                          {item.actionLabel}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Box>

          <Box>
            <Typography component="h2" sx={{ fontSize: '1.08rem', fontWeight: 760, mb: 1.25 }}>
              Prosjektstatus
            </Typography>
            <Card variant="outlined" sx={{ bgcolor: roleTokens.surface, borderColor: roleTokens.border, color: roleTokens.text }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                  {[
                    { label: 'Scener', value: brief.stats.sceneCount },
                    { label: 'Med visuell plan', value: brief.stats.visuallyPlannedSceneCount },
                    { label: 'Roller besatt', value: `${brief.stats.filledRoleCount}/${brief.stats.roleCount}` },
                    { label: 'Til vurdering', value: brief.stats.candidateReviewCount },
                  ].map((stat) => (
                    <Box key={stat.label} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Typography sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' }, fontWeight: 780 }}>
                        {stat.value}
                      </Typography>
                      <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.72rem' }}>
                        {stat.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {brief.productionDay?.kind === 'today' ? <CalendarIcon sx={{ color: '#fcd34d', fontSize: 19 }} /> : <ReadyIcon sx={{ color: '#7dd3fc', fontSize: 19 }} />}
                    <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.78rem' }}>
                      {brief.productionDay
                        ? brief.productionDay.kind === 'today'
                          ? 'Produksjonsdag registrert i dag'
                          : `Neste produksjonsdag: ${brief.productionDay.date}`
                        : 'Ingen kommende produksjonsdag funnet'}
                    </Typography>
                  </Stack>
                  {updatedLabel ? (
                    <Typography sx={{ mt: 0.75, color: 'rgba(220,205,255,0.58)', fontSize: '0.7rem' }}>
                      Prosjektdata sist oppdatert {updatedLabel}
                    </Typography>
                  ) : null}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default DirectorWorkspace;
