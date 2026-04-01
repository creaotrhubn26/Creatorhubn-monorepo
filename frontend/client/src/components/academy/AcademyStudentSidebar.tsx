import React, { useCallback, useMemo } from 'react';
import {
  AutoStories,
  EmojiEvents,
  ForumOutlined,
  HomeOutlined,
  LibraryBooksOutlined,
  TaskAltOutlined,
  PlayCircleOutline,
  SettingsOutlined,
} from '@mui/icons-material';
import { Avatar, Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import AcademyBrandMark from './AcademyBrandMark';
import {
  buildAcademyStudentSupportCard,
  useAcademyStudentAccessSummary,
} from './academyStudentExperience';

type TranslateFn = (no: string, en: string) => string;

type NavItem = {
  id: string;
  label: string;
  route: string;
  icon: React.ReactNode;
};

interface AcademyStudentSidebarProps {
  activeNav: string;
  onNavigate: (navId: string, route: string) => void;
  tt: TranslateFn;
  studentName: string;
  activeCourseId?: string | null;
  activeCourseTitle?: string;
  instructorName?: string;
  progressPercent?: number;
  completedLessons?: number;
  totalLessons?: number;
  streakDays?: number;
  returnTo?: string;
  continueRoute?: string;
  nextActionTitle?: string;
  nextActionDetail?: string;
  nextActionRoute?: string;
  nextActionLabel?: string;
}

function AcademyStudentSidebar({
  activeNav,
  onNavigate,
  tt,
  studentName,
  activeCourseId,
  activeCourseTitle,
  instructorName,
  progressPercent = 0,
  completedLessons = 0,
  totalLessons = 0,
  streakDays = 0,
  returnTo = '/academy/student-dashboard',
  continueRoute,
  nextActionTitle,
  nextActionDetail,
  nextActionRoute,
  nextActionLabel,
}: AcademyStudentSidebarProps) {
  const { data: accessSummary } = useAcademyStudentAccessSummary(
    activeCourseId ? String(activeCourseId) : undefined,
  );
  const navItems = useMemo<NavItem[]>(
    () => [
      {
        id: 'overview',
        label: tt('Oversikt', 'Overview'),
        route: '/academy/student-dashboard',
        icon: <HomeOutlined fontSize="small" />,
      },
      {
        id: 'courses',
        label: tt('Mine kurs', 'My Courses'),
        route: '/academy/student-dashboard?view=courses',
        icon: <AutoStories fontSize="small" />,
      },
      {
        id: 'resources',
        label: tt('Ressurser', 'Resources'),
        route: '/academy/media',
        icon: <LibraryBooksOutlined fontSize="small" />,
      },
      {
        id: 'assignments',
        label: tt('Oppgaver', 'Assignments'),
        route: '/academy/assignments',
        icon: <TaskAltOutlined fontSize="small" />,
      },
      {
        id: 'community',
        label: tt('Community', 'Community'),
        route: '/community',
        icon: <ForumOutlined fontSize="small" />,
      },
      {
        id: 'achievements',
        label: tt('Prestasjoner', 'Achievements'),
        route: '/academy/student-dashboard?view=achievements',
        icon: <EmojiEvents fontSize="small" />,
      },
      {
        id: 'settings',
        label: tt('Innstillinger', 'Settings'),
        route: '/academy/settings?tab=profile',
        icon: <SettingsOutlined fontSize="small" />,
      },
    ],
    [tt],
  );

  const withCourseContext = useCallback(
    (route: string) => {
      if (!route.startsWith('/academy')) return route;

      const [basePath, rawQuery = ''] = route.split('?');
      const params = new URLSearchParams(rawQuery);
      const courseValue = String(activeCourseId || '').trim();

      if (courseValue && !params.has('courseId') && !params.has('course_id')) {
        params.set('courseId', courseValue);
      }

      params.set('audience', 'student');

      const safeReturnTo = String(returnTo || '').trim();
      if (safeReturnTo && !params.has('returnTo')) {
        params.set('returnTo', safeReturnTo);
      }

      const query = params.toString();
      return query ? `${basePath}?${query}` : basePath;
    },
    [activeCourseId, returnTo],
  );

  const profileInitial = String(studentName || 'S').trim().charAt(0).toUpperCase() || 'S';
  const resolvedContinueRoute = withCourseContext(continueRoute || '/academy/player-studio');
  const resolvedNextActionRoute = withCourseContext(nextActionRoute || continueRoute || '/academy/player-studio');
  const streakDisplay = progressPercent > 0 ? Math.max(streakDays, 1) : Math.max(streakDays, 0);
  const supportCard = useMemo(
    () =>
      buildAcademyStudentSupportCard({
        tt,
        access: accessSummary?.access,
        instructorName,
      }),
    [accessSummary?.access, instructorName, tt],
  );

  return (
    <Box
      component="aside"
      sx={{
        width: '100%',
        maxWidth: '100%',
        flex: { xs: '0 0 auto', lg: '0 0 320px' },
        minWidth: 0,
        borderRight: {
          xs: 'none',
          lg: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
        },
        borderBottom: {
          xs: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
          lg: 'none',
        },
        background: 'linear-gradient(180deg, rgba(10,13,22,0.95), rgba(8,10,16,0.97))',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflowX: 'clip',
      }}
    >
      <Stack spacing={2} sx={{ px: 2.5, py: 2.4 }}>
        <AcademyBrandMark />

        <Box
          sx={{
            p: 1.35,
            borderRadius: 1.2,
            border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.24)',
            background:
              'radial-gradient(circle at 80% 14%, rgba(248,179,33,0.18), rgba(0,0,0,0) 36%), linear-gradient(145deg, rgba(18,23,34,0.96), rgba(10,14,21,0.98))',
          }}
        >
          <Stack direction="row" spacing={1.1} alignItems="center">
            <Avatar
              sx={{
                width: 46,
                height: 46,
                bgcolor: '#f8b321',
                color: '#17120a',
                fontWeight: 800,
                border: '2px solid rgba(248,179,33,0.42)',
              }}
            >
              {profileInitial}
            </Avatar>
            <Box minWidth={0}>
              <Typography sx={{ fontWeight: 700 }} noWrap>
                {studentName}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: 'rgba(237,240,247,0.66)' }} noWrap>
                {tt('Studentvisning', 'Student view')}
              </Typography>
            </Box>
          </Stack>

          <Typography sx={{ mt: 1.15, fontSize: 12, color: 'rgba(237,240,247,0.64)' }}>
            {tt('Aktiv progresjon', 'Current progress')}
          </Typography>
          <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 0.55 }}>
            <LinearProgress
              variant="determinate"
              value={Math.max(0, Math.min(100, progressPercent))}
              sx={{
                flex: 1,
                height: 8,
                borderRadius: 999,
                bgcolor: 'rgba(255,255,255,0.12)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, #f8b321 0%, #ffd761 100%)',
                },
              }}
            />
            <Typography sx={{ minWidth: 40, fontWeight: 700 }}>{progressPercent}%</Typography>
          </Stack>

          <Button
            variant="outlined"
            startIcon={<PlayCircleOutline />}
            onClick={() => onNavigate('continue', resolvedContinueRoute)}
            sx={{
              mt: 1.2,
              width: '100%',
              justifyContent: 'flex-start',
              borderColor: 'rgba(248,179,33,0.52)',
              color: '#f8d56f',
              borderRadius: 1,
              textTransform: 'none',
              fontWeight: 700,
            }}
          >
            {tt('Fortsett læring', 'Continue learning')}
          </Button>
        </Box>

        {nextActionTitle ? (
          <Box
            sx={{
              p: 1.2,
              borderRadius: 1.1,
              border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.26)',
              background:
                'radial-gradient(circle at 82% 18%, rgba(248,179,33,0.16), rgba(0,0,0,0) 34%), linear-gradient(145deg, rgba(17,22,33,0.96), rgba(10,14,21,0.98))',
            }}
          >
            <Typography sx={{ color: 'rgba(248,213,111,0.94)', fontSize: 12, fontWeight: 700 }}>
              {tt('Neste steg', 'Next step')}
            </Typography>
            <Typography sx={{ mt: 0.55, fontWeight: 700 }}>
              {nextActionTitle}
            </Typography>
            {nextActionDetail ? (
              <Typography sx={{ mt: 0.35, fontSize: 12.5, color: 'rgba(237,240,247,0.7)' }}>
                {nextActionDetail}
              </Typography>
            ) : null}
            <Button
              variant="outlined"
              startIcon={<PlayCircleOutline />}
              onClick={() => onNavigate('next-action', resolvedNextActionRoute)}
              sx={{
                mt: 1.1,
                width: '100%',
                justifyContent: 'flex-start',
                borderColor: 'rgba(255,255,255,0.18)',
                color: '#edf0f7',
                borderRadius: 1,
                textTransform: 'none',
                fontWeight: 700,
              }}
            >
              {nextActionLabel || tt('Åpne nå', 'Open now')}
            </Button>
          </Box>
        ) : null}
      </Stack>

      <Stack spacing={0.55} sx={{ px: 1.5 }}>
        {navItems.map((item) => {
          const active = item.id === activeNav;

          return (
            <Button
              key={item.id}
              onClick={() => onNavigate(item.id, withCourseContext(item.route))}
              startIcon={item.icon}
              sx={{
                justifyContent: 'flex-start',
                color: active ? '#fce3a1' : 'rgba(237,240,247,0.82)',
                borderRadius: 1,
                textTransform: 'none',
                px: 1.8,
                py: 1.05,
                width: '100%',
                border: active
                  ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)'
                  : 'var(--academy-hairline-width, 1px) solid transparent',
                background: active
                  ? 'linear-gradient(90deg, rgba(248,179,33,0.22), rgba(248,179,33,0.04))'
                  : 'transparent',
                '& .MuiButton-startIcon': {
                  color: active ? '#ffd56f' : 'rgba(237,240,247,0.6)',
                },
              }}
            >
              {item.label}
            </Button>
          );
        })}
      </Stack>

      <Box sx={{ mt: 'auto', px: 1.8, pb: 2.1, pt: 1.4 }}>
        <Box
          sx={{
            p: 1.1,
            borderRadius: 1.1,
            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
            background: 'linear-gradient(145deg, rgba(14,18,30,0.82), rgba(10,13,22,0.92))',
          }}
        >
          <Typography sx={{ color: 'rgba(248,213,111,0.94)', fontSize: 12, fontWeight: 700 }}>
            {tt('Læringsfokus', 'Learning focus')}
          </Typography>
          <Typography sx={{ mt: 0.55, fontWeight: 700 }} noWrap>
            {activeCourseTitle || tt('Velg et kurs', 'Choose a course')}
          </Typography>
          <Typography sx={{ mt: 0.35, fontSize: 12, color: 'rgba(237,240,247,0.68)' }}>
            {tt('Ferdigheter fullført', 'Lessons completed')}: {completedLessons}/{Math.max(totalLessons, 1)}
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: 12, color: 'rgba(237,240,247,0.68)' }}>
            {tt('Streak', 'Streak')}: {streakDisplay} {tt('dager', 'days')}
          </Typography>
        </Box>

        <Box
          sx={{
            mt: 1,
            p: 1.1,
            borderRadius: 1.1,
            border:
              supportCard.tone === 'success'
                ? 'var(--academy-hairline-width, 1px) solid rgba(154,210,123,0.22)'
                : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
            background:
              supportCard.tone === 'success'
                ? 'linear-gradient(145deg, rgba(17,29,22,0.82), rgba(10,18,14,0.92))'
                : 'linear-gradient(145deg, rgba(14,18,30,0.82), rgba(10,13,22,0.92))',
          }}
        >
          <Typography sx={{ color: 'rgba(248,213,111,0.94)', fontSize: 12, fontWeight: 700 }}>
            {supportCard.eyebrow}
          </Typography>
          <Typography sx={{ mt: 0.55, fontWeight: 700 }}>
            {supportCard.title}
          </Typography>
          <Typography sx={{ mt: 0.35, fontSize: 12, color: 'rgba(237,240,247,0.68)' }}>
            {supportCard.detail}
          </Typography>
          {supportCard.meta ? (
            <Typography sx={{ mt: 0.3, fontSize: 12, color: 'rgba(237,240,247,0.5)' }}>
              {supportCard.meta}
            </Typography>
          ) : null}
          <Button
            variant="text"
            startIcon={<ForumOutlined fontSize="small" />}
            onClick={() => onNavigate('messages', withCourseContext('/academy/settings?tab=messages'))}
            sx={{
              mt: 0.75,
              px: 0,
              minWidth: 0,
              justifyContent: 'flex-start',
              textTransform: 'none',
              color: '#f8d56f',
              fontWeight: 700,
            }}
          >
            {tt('Åpne meldinger', 'Open messages')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default AcademyStudentSidebar;
