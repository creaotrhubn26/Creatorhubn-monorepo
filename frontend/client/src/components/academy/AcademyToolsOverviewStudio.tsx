import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import {
  Campaign,
  Edit,
  Groups,
  MonetizationOn,
  PlayArrow,
  Quiz,
  Slideshow,
  Subtitles,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyLocaleSwitcher from './AcademyLocaleSwitcher';
import AcademyLeftSidebar from './AcademyLeftSidebar';

type ToolItem = {
  id: string;
  navId: string;
  labelNo: string;
  labelEn: string;
  descriptionNo: string;
  descriptionEn: string;
  route: string;
  icon: React.ReactNode;
};

const panelSx = {
  borderRadius: 1.4,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const toolItems: ToolItem[] = [
  {
    id: 'annotation',
    navId: 'tool-annotation',
    labelNo: 'Annoteringsstudio',
    labelEn: 'Annotation Studio',
    descriptionNo: 'Legg til tidskodede notater, markører og redaksjonelle kommentarer i video.',
    descriptionEn: 'Add time-coded notes, markers, and editorial comments in video.',
    route: '/academy/annotation-editor',
    icon: <Edit />,
  },
  {
    id: 'quiz',
    navId: 'tool-quiz',
    labelNo: 'Quiz Studio',
    labelEn: 'Quiz Studio',
    descriptionNo: 'Bygg vurderinger med spørsmål, poengsetting og progresjonslogikk.',
    descriptionEn: 'Build assessments with questions, scoring, and progression logic.',
    route: '/academy/quiz-manager',
    icon: <Quiz />,
  },
  {
    id: 'cta',
    navId: 'tool-cta',
    labelNo: 'CTA-Studio',
    labelEn: 'CTA Studio',
    descriptionNo: 'Sett handlingselementer i avspilling med tidsstyrte call-to-actions.',
    descriptionEn: 'Configure in-player actions with timed call-to-actions.',
    route: '/academy/cta-overlay',
    icon: <Campaign />,
  },
  {
    id: 'lower-thirds',
    navId: 'tool-lower-thirds',
    labelNo: 'Supring Studio',
    labelEn: 'Lower Thirds Studio',
    descriptionNo: 'Administrer navneskilt, titler og grafikk over video.',
    descriptionEn: 'Manage nameplates, titles, and graphics over video.',
    route: '/academy/lower-thirds',
    icon: <Subtitles />,
  },
  {
    id: 'presentation-overlay',
    navId: 'tool-presentation',
    labelNo: 'Presentasjonsstudio',
    labelEn: 'Presentation Studio',
    descriptionNo: 'Last opp PPT/PDF, velg slide-rekkefolge, tidsplassering og visningsmal i video.',
    descriptionEn: 'Upload PPT/PDF, set slide order, timeline placement, and display template in video.',
    route: '/academy/presentation-overlay',
    icon: <Slideshow />,
  },
  {
    id: 'instructors',
    navId: 'instructors',
    labelNo: 'Instruktører',
    labelEn: 'Instructors',
    descriptionNo: 'Administrer instruktører, fagansvarlige og rollefordeling per ferdighet.',
    descriptionEn: 'Manage instructors, competency leads, and per-skill role assignments.',
    route: '/academy/instructors',
    icon: <Groups />,
  },
  {
    id: 'player',
    navId: 'lessons',
    labelNo: 'Spiller',
    labelEn: 'Player',
    descriptionNo: 'Forhåndsvis og kvalitetssikre læringsopplevelsen i Academy Player Studio.',
    descriptionEn: 'Preview and QA the learning experience in Academy Player Studio.',
    route: '/academy/player-studio',
    icon: <PlayArrow />,
  },
  {
    id: 'monetization',
    navId: 'tool-monetization',
    labelNo: 'Monetisering',
    labelEn: 'Monetization',
    descriptionNo: 'Styr priser, kampanjer, bundles og inntektsoppsett for kurs.',
    descriptionEn: 'Manage pricing, campaigns, bundles, and course revenue setup.',
    route: '/academy/monetization',
    icon: <MonetizationOn />,
  },
];

function AcademyToolsOverviewStudio() {
  const [, setLocation] = useLocation();
  const { state } = useAcademy();
  const { analytics } = useEnhancedMasterIntegration();
  const { tt, navLabel } = useAcademyLocale();
  const [leftNav, setLeftNav] = useState('tools');

  const items = useMemo(() => toolItems, []);

  useEffect(() => {
    analytics.trackEvent('academy_tools_overview_opened', {
      toolCount: items.length,
      timestamp: Date.now(),
    });
  }, [analytics, items.length]);

  const syncedCourseId = useMemo(() => {
    const fromContext = String(state.currentCourse?.id || '').trim();
    if (fromContext) return fromContext;
    if (typeof window === 'undefined') return '';
    return String(
      new URLSearchParams(window.location.search).get('courseId') ||
        new URLSearchParams(window.location.search).get('course_id') ||
        '',
    ).trim();
  }, [state.currentCourse?.id]);

  const withCourseContext = useCallback(
    (route: string) => {
      if (!syncedCourseId) return route;
      const hasCourseParam = route.includes('courseId=') || route.includes('course_id=');
      if (hasCourseParam) return route;
      const separator = route.includes('?') ? '&' : '?';
      return `${route}${separator}courseId=${encodeURIComponent(syncedCourseId)}`;
    },
    [syncedCourseId],
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: '#edf0f7',
        bgcolor: '#06080d',
        fontFamily: '"Manrope", "Barlow", "Segoe UI", sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 74% 12%, rgba(248,179,33,0.24), rgba(5,8,13,0) 42%), radial-gradient(circle at 16% 74%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 32%)',
        }}
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '252px minmax(0, 1fr)' },
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
          width: 'min(100%, var(--academy-shell-max-width, 1920px))',
          mx: 'auto',
          overflowX: 'hidden',
        }}
      >
        <AcademyLeftSidebar
          activeNav={leftNav}
          onNavigate={(navId, route) => {
            setLeftNav(navId);
            setLocation(withCourseContext(route));
          }}
          onCreateCourse={() => {
            setLeftNav('curriculum');
            setLocation(withCourseContext('/academy/curriculum?createCompetency=1'));
          }}
          tt={tt}
          navLabel={navLabel}
          activeCourseId={syncedCourseId || null}
        />

        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              height: 74,
              px: 3,
              borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))',
            }}
          >
            <Stack direction="row" spacing={1.4} alignItems="center" sx={{ minWidth: 0 }}>
              <Typography sx={{ letterSpacing: '0.22em', fontSize: 15, color: 'rgba(237,240,247,0.82)' }}>
                CREATOR STUDIO
              </Typography>
              <Typography sx={{ fontSize: 21, fontWeight: 600 }} noWrap>
                {tt('Verktøyoversikt', 'Tools Overview')}
              </Typography>
            </Stack>

            <AcademyLocaleSwitcher />
          </Box>

          <Box sx={{ p: { xs: 2, md: 2.6 }, display: 'grid', gap: 1.6 }}>
            <Box sx={{ ...panelSx, p: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
                    {tt('Alle verktøy samlet', 'All Tools in One Place')}
                  </Typography>
                  <Typography sx={{ mt: 0.7, color: 'rgba(237,240,247,0.74)' }}>
                    {tt(
                      'Åpne riktig studio for redigering, interaksjon, avspilling og inntektsstyring.',
                      'Open the right studio for editing, interactivity, playback, and monetization.',
                    )}
                  </Typography>
                </Box>
                <Chip
                  label={tt(`${items.length} verktøy`, `${items.length} tools`)}
                  sx={{
                    color: '#fce3a1',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.36)',
                    bgcolor: 'rgba(248,179,33,0.1)',
                    fontWeight: 700,
                  }}
                />
              </Stack>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gap: 1.4,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {items.map((item) => (
                <Box key={item.id} sx={{ ...panelSx, p: 2 }}>
                  <Stack spacing={1.3}>
                    <Stack direction="row" spacing={1.1} alignItems="center">
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: 0.9,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                          bgcolor: 'rgba(255,255,255,0.05)',
                        }}
                      >
                        {item.icon}
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: 20 }}>
                        {tt(item.labelNo, item.labelEn)}
                      </Typography>
                    </Stack>

                    <Typography sx={{ color: 'rgba(237,240,247,0.78)', minHeight: 46 }}>
                      {tt(item.descriptionNo, item.descriptionEn)}
                    </Typography>

                    <Button
                      onClick={() => {
                        setLeftNav(item.navId);
                        setLocation(withCourseContext(item.route));
                      }}
                      sx={{
                        alignSelf: 'flex-start',
                        textTransform: 'none',
                        color: '#0f0f0f',
                        fontWeight: 700,
                        background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                        borderRadius: 1,
                        px: 1.8,
                        boxShadow: '0 10px 24px rgba(248,179,33,0.24)',
                      }}
                    >
                      {tt('Åpne verktøy', 'Open Tool')}
                    </Button>
                  </Stack>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyToolsOverviewStudio, {
  componentId: 'academy-tools-overview-studio',
  componentName: 'Academy Tools Overview Studio',
  componentType: 'dashboard',
  componentCategory: 'academy',
  featureIds: ['academy-tools-overview', 'academy-tool-navigation'],
});
