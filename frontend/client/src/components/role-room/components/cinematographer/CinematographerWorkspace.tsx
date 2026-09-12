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
  BadgeOutlined as CrewIcon,
  CameraAltOutlined as CameraIcon,
  FactCheckOutlined as EvidenceIcon,
  HighlightOutlined as LightingIcon,
  MovieFilterOutlined as ShotPlanIcon,
  SpaceDashboardOutlined as FullWorkspaceIcon,
  TodayOutlined as TodayIcon,
  VideoCameraBackOutlined as SceneIcon,
  VideocamOutlined as OnSetIcon,
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
  buildCinematographerBrief,
  type CinematographerBriefTone,
  type CinematographerSurface,
} from './cinematographerWorkspaceModel';

interface CinematographerWorkspaceProps {
  project: CastingProject;
  activeSurface?: CinematographerSurface;
  readOnly?: boolean;
  isSurfaceAvailable?: (surface: CinematographerSurface) => boolean;
  onNavigate: (surface: CinematographerSurface) => void;
  onOpenFullWorkspace: () => void;
}

const SURFACES: ReadonlyArray<{
  value: CinematographerSurface;
  label: string;
  icon: ElementType;
}> = [
  { value: 'today', label: 'I dag', icon: TodayIcon },
  { value: 'scenes', label: 'Scener', icon: SceneIcon },
  { value: 'shot-plan', label: 'Shotplan', icon: ShotPlanIcon },
  { value: 'lighting-equipment', label: 'Lys og utstyr', icon: LightingIcon },
  { value: 'camera-crew', label: 'Kameracrew', icon: CrewIcon },
  { value: 'on-set', label: 'På sett', icon: OnSetIcon },
];

const TONE_STYLES: Record<
  CinematographerBriefTone,
  { color: string; background: string; border: string }
> = {
  attention: {
    color: '#fcd34d',
    background: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.27)',
  },
  upcoming: {
    color: '#7dd3fc',
    background: 'rgba(14, 165, 233, 0.08)',
    border: 'rgba(56, 189, 248, 0.24)',
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

export function CinematographerWorkspace({
  project,
  activeSurface = 'today',
  readOnly = false,
  isSurfaceAvailable,
  onNavigate,
  onOpenFullWorkspace,
}: CinematographerWorkspaceProps) {
  const { isMobile } = useScreenTier();
  const brief = useMemo(() => buildCinematographerBrief({ project }), [project]);
  const targetSize = isMobile ? MOBILE_TOUCH_TARGET_SIZE : TOUCH_TARGET_SIZE;
  const updatedLabel = formatProjectTime(brief.projectUpdatedAt);

  return (
    <Box
      component="section"
      aria-labelledby="cinematographer-workspace-title"
      data-testid="cinematographer-workspace"
      sx={{
        minHeight: '100%',
        overflowY: 'auto',
        bgcolor: '#080d14',
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
                icon={<CameraIcon sx={{ color: '#7dd3fc !important' }} />}
                label="FILMFOTOGRAF · DoP"
                size="small"
                sx={{
                  height: 25,
                  color: '#bae6fd',
                  bgcolor: 'rgba(14, 165, 233, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  fontWeight: 800,
                  letterSpacing: 0.55,
                }}
              />
              {readOnly ? <Chip label="Skrivebeskyttet" size="small" variant="outlined" /> : null}
            </Stack>
            <Typography
              id="cinematographer-workspace-title"
              component="h1"
              sx={{ fontSize: { xs: '1.45rem', md: '1.9rem' }, fontWeight: 780 }}
            >
              {project.name}
            </Typography>
            <Typography sx={{ color: roleTokens.textMuted, mt: 0.25, maxWidth: 760 }}>
              Bildedekning, kamera, lys og teknisk crew samlet fra prosjektets registrerte produksjonsdata.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<FullWorkspaceIcon />}
            onClick={onOpenFullWorkspace}
            data-testid="cinematographer-open-full-workspace"
            sx={{
              minHeight: targetSize,
              color: roleTokens.text,
              borderColor: 'rgba(56, 189, 248, 0.34)',
              alignSelf: { xs: 'stretch', md: 'center' },
              ...focusVisibleStyles,
            }}
          >
            Hele prosjektet
          </Button>
        </Box>

        <Box
          component="nav"
          aria-label="Filmfotografens arbeidsflater"
          data-testid="cinematographer-surface-nav"
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
            border: '1px solid rgba(56, 189, 248, 0.24)',
            bgcolor: 'rgba(14, 18, 30, 0.92)',
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
                data-testid={`cinematographer-surface-${value}`}
                sx={{
                  minHeight: targetSize,
                  justifyContent: 'flex-start',
                  px: 1.5,
                  color: selected ? '#fff' : roleTokens.textMuted,
                  bgcolor: selected ? 'rgba(14, 165, 233, 0.16)' : 'transparent',
                  border: selected
                    ? '1px solid rgba(56, 189, 248, 0.34)'
                    : '1px solid transparent',
                  '&:hover': {
                    bgcolor: selected
                      ? 'rgba(14, 165, 233, 0.22)'
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
          data-testid="cinematographer-today"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              lg: 'minmax(0, 1.6fr) minmax(340px, 0.7fr)',
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
                  Tekniske avklaringer
                </Typography>
                <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.82rem' }}>
                  Hvert kort viser datakilden og hvorfor det vises.
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
                    data-testid={`cinematographer-action-${item.id}`}
                    sx={{ bgcolor: tone.background, borderColor: tone.border, color: roleTokens.text }}
                  >
                    <CardContent
                      sx={{
                        p: { xs: 1.5, sm: 2 },
                        '&:last-child': { pb: { xs: 1.5, sm: 2 } },
                      }}
                    >
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
                          <Typography
                            sx={{ mt: 0.35, color: roleTokens.textMuted, fontSize: '0.82rem', lineHeight: 1.5 }}
                          >
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
              Bildestatus
            </Typography>
            <Card
              variant="outlined"
              sx={{
                bgcolor: 'rgba(7, 31, 45, 0.76)',
                borderColor: 'rgba(56, 189, 248, 0.24)',
                color: roleTokens.text,
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                  {[
                    { label: 'Scener med shots', value: `${brief.stats.scenesWithShots}/${brief.stats.sceneCount}` },
                    { label: 'Shots', value: brief.stats.shotCount },
                    { label: 'Kamera spesifisert', value: `${brief.stats.cameraReadyShots}/${brief.stats.shotCount}` },
                    { label: 'Lys spesifisert', value: `${brief.stats.lightingReadyShots}/${brief.stats.shotCount}` },
                    { label: 'Teknisk crew', value: brief.stats.technicalCrewCount },
                    { label: 'Crew bekreftet', value: `${brief.stats.confirmedTechnicalCrewCount}/${brief.stats.technicalCrewCount}` },
                  ].map((stat) => (
                    <Box
                      key={stat.label}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(14, 165, 233, 0.055)',
                        border: '1px solid rgba(56, 189, 248, 0.1)',
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
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.76rem' }}>
                    {brief.productionDay
                      ? brief.productionDay.kind === 'today'
                        ? 'Opptaksdag registrert i dag'
                        : `Neste opptaksdag: ${brief.productionDay.date}`
                      : 'Ingen kommende opptaksdag funnet'}
                  </Typography>
                  {updatedLabel ? (
                    <Typography sx={{ mt: 0.7, color: 'rgba(186,230,253,0.58)', fontSize: '0.7rem' }}>
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

export default CinematographerWorkspace;
