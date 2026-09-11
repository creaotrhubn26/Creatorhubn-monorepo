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
  AssignmentOutlined as CallSheetIcon,
  CalendarMonthOutlined as ShootingPlanIcon,
  CheckCircleOutline as ReadyIcon,
  FactCheckOutlined as EvidenceIcon,
  GroupsOutlined as CastCrewIcon,
  SpaceDashboardOutlined as FullWorkspaceIcon,
  TodayOutlined as TodayIcon,
  VideoCameraBackOutlined as OnSetIcon,
  ViewAgendaOutlined as StripboardIcon,
  WarningAmberOutlined as AttentionIcon,
} from '@mui/icons-material';
import type { CastingProject } from '../../models/casting';
import {
  MOBILE_TOUCH_TARGET_SIZE,
  TOUCH_TARGET_SIZE,
  focusVisibleStyles,
} from '../../constants/accessibility';
import { roleTokens } from '../../theme/roleTokens';
import { useScreenTier } from '../production/useScreenTier';
import {
  buildFirstAssistantDirectorBrief,
  type FirstAssistantDirectorBriefTone,
  type FirstAssistantDirectorSurface,
} from './firstAssistantDirectorWorkspaceModel';

interface FirstAssistantDirectorWorkspaceProps {
  project: CastingProject;
  activeSurface?: FirstAssistantDirectorSurface;
  readOnly?: boolean;
  isSurfaceAvailable?: (surface: FirstAssistantDirectorSurface) => boolean;
  onNavigate: (surface: FirstAssistantDirectorSurface) => void;
  onOpenFullWorkspace: () => void;
}

const SURFACES: ReadonlyArray<{
  value: FirstAssistantDirectorSurface;
  label: string;
  icon: ElementType;
}> = [
  { value: 'today', label: 'I dag', icon: TodayIcon },
  { value: 'stripboard', label: 'Stripboard', icon: StripboardIcon },
  { value: 'shooting-plan', label: 'Opptaksplan', icon: ShootingPlanIcon },
  { value: 'call-sheet', label: 'Callsheet', icon: CallSheetIcon },
  { value: 'cast-crew', label: 'Cast og crew', icon: CastCrewIcon },
  { value: 'on-set', label: 'På sett', icon: OnSetIcon },
];

const TONE_STYLES: Record<
  FirstAssistantDirectorBriefTone,
  { color: string; background: string; border: string }
> = {
  attention: {
    color: '#fca5a5',
    background: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(248, 113, 113, 0.27)',
  },
  upcoming: {
    color: '#fdba74',
    background: 'rgba(249, 115, 22, 0.08)',
    border: 'rgba(251, 146, 60, 0.25)',
  },
  ready: {
    color: '#6ee7b7',
    background: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.24)',
  },
  neutral: {
    color: roleTokens.textMuted,
    background: 'rgba(148, 163, 184, 0.06)',
    border: 'rgba(148, 163, 184, 0.18)',
  },
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

export function FirstAssistantDirectorWorkspace({
  project,
  activeSurface = 'today',
  readOnly = false,
  isSurfaceAvailable,
  onNavigate,
  onOpenFullWorkspace,
}: FirstAssistantDirectorWorkspaceProps) {
  const { isMobile } = useScreenTier();
  const brief = useMemo(() => buildFirstAssistantDirectorBrief({ project }), [project]);
  const targetSize = isMobile ? MOBILE_TOUCH_TARGET_SIZE : TOUCH_TARGET_SIZE;
  const updatedLabel = formatProjectTime(brief.projectUpdatedAt);

  return (
    <Box
      component="section"
      aria-labelledby="first-ad-workspace-title"
      data-testid="first-ad-workspace"
      sx={{
        minHeight: '100%',
        overflowY: 'auto',
        bgcolor: '#0b0c12',
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
                icon={<AttentionIcon sx={{ color: '#fdba74 !important' }} />}
                label="1ST AD · INNSPILLINGSLEDELSE"
                size="small"
                sx={{
                  height: 25,
                  color: '#fed7aa',
                  bgcolor: 'rgba(249, 115, 22, 0.12)',
                  border: '1px solid rgba(251, 146, 60, 0.3)',
                  fontWeight: 800,
                  letterSpacing: 0.55,
                }}
              />
              {readOnly ? <Chip label="Skrivebeskyttet" size="small" variant="outlined" /> : null}
            </Stack>
            <Typography
              id="first-ad-workspace-title"
              component="h1"
              sx={{ fontSize: { xs: '1.45rem', md: '1.9rem' }, fontWeight: 780 }}
            >
              {project.name}
            </Typography>
            <Typography sx={{ color: roleTokens.textMuted, mt: 0.25, maxWidth: 800 }}>
              Fremdrift, opptaksrekkefølge og dagsberedskap samlet fra prosjektets registrerte produksjonsdata.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<FullWorkspaceIcon />}
            onClick={onOpenFullWorkspace}
            data-testid="first-ad-open-full-workspace"
            sx={{
              minHeight: targetSize,
              color: roleTokens.text,
              borderColor: 'rgba(251, 146, 60, 0.34)',
              alignSelf: { xs: 'stretch', md: 'center' },
              ...focusVisibleStyles,
            }}
          >
            Hele prosjektet
          </Button>
        </Box>

        <Box
          component="nav"
          aria-label="1st ADs arbeidsflater"
          data-testid="first-ad-surface-nav"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(3, minmax(0, 1fr))',
              lg: 'repeat(6, minmax(0, 1fr))',
            },
            gap: 1,
            p: 1,
            mb: 2.5,
            border: '1px solid rgba(251, 146, 60, 0.24)',
            bgcolor: 'rgba(18, 18, 26, 0.94)',
            borderRadius: 2,
          }}
        >
          {SURFACES.map(({ value, label, icon: Icon }) => {
            const selected = value === activeSurface;
            const available = isSurfaceAvailable?.(value) ?? true;
            return (
              <Button
                key={value}
                onClick={() => onNavigate(value)}
                disabled={!available}
                startIcon={<Icon sx={{ fontSize: 19 }} />}
                aria-current={selected ? 'page' : undefined}
                data-testid={`first-ad-surface-${value}`}
                sx={{
                  minHeight: targetSize,
                  justifyContent: 'flex-start',
                  px: 1.5,
                  color: selected ? '#fff' : roleTokens.textMuted,
                  bgcolor: selected ? 'rgba(249, 115, 22, 0.16)' : 'transparent',
                  border: selected
                    ? '1px solid rgba(251, 146, 60, 0.34)'
                    : '1px solid transparent',
                  '&:hover': {
                    bgcolor: selected
                      ? 'rgba(249, 115, 22, 0.22)'
                      : 'rgba(255,255,255,0.05)',
                  },
                  ...focusVisibleStyles,
                }}
              >
                {label}
              </Button>
            );
          })}
        </Box>

        <Box
          data-testid="first-ad-today"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              lg: 'minmax(0, 1.55fr) minmax(350px, 0.75fr)',
            },
            gap: 2,
          }}
        >
          <Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              gap={1}
              sx={{ mb: 1.25 }}
            >
              <Box>
                <Typography component="h2" sx={{ fontSize: '1.08rem', fontWeight: 760 }}>
                  Dagens avklaringer
                </Typography>
                <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.82rem' }}>
                  Hvert avvik forklarer datakilden og hva som faktisk mangler.
                </Typography>
              </Box>
              <Chip
                icon={<EvidenceIcon sx={{ color: '#6ee7b7 !important' }} />}
                label="Kun registrerte data"
                size="small"
                sx={{
                  color: '#a7f3d0',
                  bgcolor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                }}
              />
            </Stack>

            <Stack spacing={1.25}>
              {brief.items.map((item) => {
                const tone = TONE_STYLES[item.tone];
                return (
                  <Card
                    key={item.id}
                    variant="outlined"
                    data-testid={`first-ad-action-${item.id}`}
                    sx={{ bgcolor: tone.background, borderColor: tone.border, color: roleTokens.text }}
                  >
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: { xs: 'stretch', sm: 'center' },
                          justifyContent: 'space-between',
                          flexDirection: { xs: 'column', sm: 'row' },
                          gap: 1.5,
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Chip
                            label={item.sourceLabel}
                            size="small"
                            sx={{
                              height: 22,
                              mb: 0.75,
                              color: tone.color,
                              bgcolor: 'rgba(0,0,0,0.18)',
                              fontSize: '0.68rem',
                            }}
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
                          disabled={!(isSurfaceAvailable?.(item.target) ?? true)}
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
              Opptaksberedskap
            </Typography>
            <Card
              variant="outlined"
              sx={{
                bgcolor: 'rgba(35, 20, 12, 0.72)',
                borderColor: 'rgba(251, 146, 60, 0.24)',
                color: roleTokens.text,
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                  {[
                    { label: 'Planlagte scener', value: `${brief.stats.scheduledSceneCount}/${brief.stats.sceneCount}` },
                    { label: 'Ikke planlagt', value: brief.stats.unscheduledSceneCount },
                    { label: 'Kommende dager', value: brief.stats.upcomingProductionDayCount },
                    { label: 'Dagens sider', value: brief.productionDay?.pageCount ?? 0 },
                    { label: 'Crew tildelt', value: brief.stats.assignedCrewCount },
                    { label: 'Crew bekreftet', value: `${brief.stats.confirmedAssignedCrewCount}/${brief.stats.assignedCrewCount}` },
                  ].map((stat) => (
                    <Box
                      key={stat.label}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(249, 115, 22, 0.05)',
                        border: '1px solid rgba(251, 146, 60, 0.1)',
                      }}
                    >
                      <Typography sx={{ fontSize: { xs: '1.15rem', md: '1.4rem' }, fontWeight: 780 }}>
                        {stat.value}
                      </Typography>
                      <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.7rem' }}>
                        {stat.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Stack spacing={0.8} sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  {brief.readiness.length > 0 ? brief.readiness.map((check) => (
                    <Box
                      key={check.id}
                      data-testid={`first-ad-readiness-${check.id}`}
                      sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
                    >
                      {check.ready
                        ? <ReadyIcon sx={{ mt: 0.1, fontSize: 18, color: '#6ee7b7' }} />
                        : <AttentionIcon sx={{ mt: 0.1, fontSize: 18, color: '#fca5a5' }} />}
                      <Box>
                        <Typography sx={{ fontSize: '0.76rem', fontWeight: 730 }}>
                          {check.label}
                        </Typography>
                        <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.7rem', lineHeight: 1.45 }}>
                          {check.detail}
                        </Typography>
                      </Box>
                    </Box>
                  )) : (
                    <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.76rem' }}>
                      Velg eller opprett en kommende opptaksdag for å se beredskapssjekken.
                    </Typography>
                  )}
                </Stack>

                {updatedLabel ? (
                  <Typography sx={{ mt: 1.2, color: 'rgba(254,215,170,0.55)', fontSize: '0.68rem' }}>
                    Prosjektdata sist oppdatert {updatedLabel}
                  </Typography>
                ) : null}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default FirstAssistantDirectorWorkspace;
