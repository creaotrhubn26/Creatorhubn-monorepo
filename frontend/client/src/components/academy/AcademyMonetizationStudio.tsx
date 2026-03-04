import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  AttachMoney,
  Campaign,
  Delete,
  LocalOffer,
  MailOutline,
  MonetizationOn,
  MoreHoriz,
  NotificationsNone,
  PlayArrow,
  Publish,
  Save,
  Search,
  Subtitles,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy, type Course } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyBrandMark from './AcademyBrandMark';

interface AcademyMonetizationStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

interface CouponItem {
  id: string;
  code: string;
  percent: number;
  usage: number;
  active: boolean;
}

interface BundleItem {
  id: string;
  title: string;
  monthlyPrice: number;
  subscribers: number;
  description: string;
  tier: 'basic' | 'pro' | 'elite';
}

interface RevenuePoint {
  label: string;
  value: number;
}

type RightTab = 'monetization' | 'pricing' | 'concierges';
type PricingModel = 'one_time' | 'subscription' | 'bundle';

const fallbackCourses: Course[] = [
  {
    id: 'monetization-course-1',
    title: 'Directing Masterclass',
    description: 'Advanced cinematography workflows for premium film productions.',
    instructor: {
      id: 'academy-instructor',
      name: 'Norwedfilm',
      avatar: '',
      bio: 'Film director',
      profession: 'videographer',
    },
    thumbnail: '',
    videoUrl: '/assets/academy/intro-video.mp4',
    duration: 336,
    level: 'advanced',
    category: 'videography',
    tags: ['directing', 'cinematography'],
    price: 36984,
    isFree: false,
    isPublished: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rating: 4.8,
    studentCount: 232,
    lessons: [],
    prerequisites: [],
    learningOutcomes: [],
    resources: [],
  },
  {
    id: 'monetization-course-2',
    title: 'Advanced Cinematography',
    description: 'Deep dive into high-end visual storytelling and production systems.',
    instructor: {
      id: 'academy-instructor-2',
      name: 'CreatorHub Academy',
      avatar: '',
      bio: 'Academy editorial team',
      profession: 'videographer',
    },
    thumbnail: '',
    videoUrl: '/assets/academy/intro-video.mp4',
    duration: 490,
    level: 'advanced',
    category: 'videography',
    tags: ['cinematography', 'camera'],
    price: 28740,
    isFree: false,
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rating: 4.7,
    studentCount: 145,
    lessons: [],
    prerequisites: [],
    learningOutcomes: [],
    resources: [],
  },
];

const defaultCoupons: CouponItem[] = [
  { id: 'coupon-1', code: 'MASTERCLASS20', percent: 20, usage: 57, active: true },
  { id: 'coupon-2', code: 'CREATOR10', percent: 10, usage: 113, active: true },
  { id: 'coupon-3', code: 'SPRING15', percent: 15, usage: 21, active: false },
];

const defaultBundles: BundleItem[] = [
  {
    id: 'bundle-1',
    title: 'Creator Plus Bundle',
    monthlyPrice: 520,
    subscribers: 230,
    description: 'Access to directing, cinematography and post-production tracks.',
    tier: 'pro',
  },
  {
    id: 'bundle-2',
    title: 'Business Essentials',
    monthlyPrice: 200,
    subscribers: 20,
    description: 'Sales, positioning and community growth modules.',
    tier: 'basic',
  },
];

const toNok = (value: number): string =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

const formatCompact = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.max(0, value));

const panelSx = {
  borderRadius: 1.4,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

function AcademyMonetizationStudio({ courseId, onSave, onCancel }: AcademyMonetizationStudioProps) {
  const [, setLocation] = useLocation();
  const { state, getCourse, updateCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  
  const { navLabel, tt } = useAcademyLocale();

  const [leftNav, setLeftNav] = useState('monetization');
  const [rightTab, setRightTab] = useState<RightTab>('monetization');
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [pricingModel, setPricingModel] = useState<PricingModel>('one_time');
  const [platformShare, setPlatformShare] = useState(20);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || '');
  const [oneTimePrice, setOneTimePrice] = useState(36984);
  const [monthlyPrice, setMonthlyPrice] = useState(299);
  const [annualPrice, setAnnualPrice] = useState(2990);
  const [bundlePrice, setBundlePrice] = useState(8900);
  const [couponQuery, setCouponQuery] = useState('');
  const [couponPercent, setCouponPercent] = useState(15);
  const [searchValue, setSearchValue] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [couponItems, setCouponItems] = useState<CouponItem[]>(defaultCoupons);
  const [bundleItems, setBundleItems] = useState<BundleItem[]>(defaultBundles);

  const courseItems = useMemo(() => {
    if (Array.isArray(state.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return fallbackCourses;
  }, [state.courses]);

  const activeCourse = useMemo(() => {
    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;

    const fromSelected = selectedCourseId ? courseItems.find((course) => course.id === selectedCourseId) : null;
    if (fromSelected) return fromSelected;

    return state.currentCourse || courseItems[0] || fallbackCourses[0];
  }, [courseId, courseItems, getCourse, selectedCourseId, state.currentCourse]);

  useEffect(() => {
    if (!selectedCourseId && activeCourse?.id) {
      setSelectedCourseId(activeCourse.id);
    }
  }, [activeCourse?.id, selectedCourseId]);

  useEffect(() => {
    if (!activeCourse) return;
    setOneTimePrice(Number(activeCourse.price || 0));
    setMonthlyPrice(Math.max(99, Math.round(Number(activeCourse.price || 0) * 0.012)));
    setAnnualPrice(Math.max(899, Math.round(Number(activeCourse.price || 0) * 0.102)));
    setBundlePrice(Math.max(2400, Math.round(Number(activeCourse.price || 0) * 0.24)));
  }, [activeCourse]);

  useEffect(() => {
    analytics.trackEvent('academy_monetization_studio_opened', {
      courseId: activeCourse?.id || null,
      courseCount: courseItems.length,
      timestamp: Date.now(),
    });
    debugging.logIntegration('info', 'AcademyMonetizationStudio opened', {
      courseId: activeCourse?.id || null,
      courseCount: courseItems.length,
    });
  }, [activeCourse?.id, analytics, courseItems.length, debugging]);

  const courseRows = useMemo(() => {
    return courseItems
      .map((course) => {
        const price = Number(course.price || 0);
        const students = Number(course.studentCount || 0);
        const revenue = Math.round(price * students * ((100 - platformShare) / 100));
        return {
          id: course.id,
          title: course.title,
          students,
          revenue,
          price,
          tags: Array.isArray(course.tags) ? course.tags : [],
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [courseItems, platformShare]);

  const filteredRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return courseRows;
    return courseRows.filter((row) => row.title.toLowerCase().includes(query));
  }, [courseRows, searchValue]);

  const totalStudents = useMemo(
    () => courseRows.reduce((sum, row) => sum + row.students, 0),
    [courseRows],
  );

  const totalEarnings = useMemo(
    () => courseRows.reduce((sum, row) => sum + row.revenue, 0),
    [courseRows],
  );

  const mrr = useMemo(() => {
    const recurring = bundleItems.reduce((sum, item) => sum + item.monthlyPrice * item.subscribers, 0);
    return recurring + Math.round(totalEarnings * 0.17);
  }, [bundleItems, totalEarnings]);

  const arpu = useMemo(() => {
    if (!totalStudents) return 0;
    return Math.round(totalEarnings / totalStudents);
  }, [totalEarnings, totalStudents]);

  const couponRevenue = useMemo(() => {
    return couponItems.reduce((sum, item) => sum + item.usage * item.percent * 28, 0);
  }, [couponItems]);

  const revenueSeries = useMemo<RevenuePoint[]>(() => {
    const scale = range === '7d' ? 0.35 : range === '30d' ? 1 : 2.1;
    const baseline = Math.max(12000, Math.round(totalEarnings * 0.15 * scale));
    const labels = range === '7d'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : range === '30d'
        ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']
        : ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];

    return labels.map((label, index) => {
      const wave = 0.78 + index * 0.07 + (index % 2 === 0 ? 0.05 : -0.01);
      return {
        label,
        value: Math.round(baseline * wave + couponRevenue * 0.12),
      };
    });
  }, [couponRevenue, range, totalEarnings]);

  const chartPoints = useMemo(() => {
    const max = Math.max(...revenueSeries.map((point) => point.value), 1);
    return revenueSeries.map((point, index) => {
      const x = revenueSeries.length === 1 ? 0 : (index / (revenueSeries.length - 1)) * 100;
      const y = 100 - (point.value / max) * 100;
      return { ...point, x, y };
    });
  }, [revenueSeries]);

  const createCoupon = useCallback(() => {
    const normalized = couponQuery.trim().toUpperCase().replace(/\s+/g, '');
    const code = normalized || `ACADEMY${Math.floor(Math.random() * 900 + 100)}`;
    const next: CouponItem = {
      id: `coupon-${Date.now()}`,
      code,
      percent: Math.max(5, Math.min(90, couponPercent)),
      usage: 0,
      active: true,
    };

    setCouponItems((prev) => [next, ...prev]);
    setCouponQuery('');
    setSaveMessage(tt(`Kupong ${code} opprettet.`, `Coupon ${code} created.`));

    analytics.trackEvent('academy_coupon_created', {
      courseId: activeCourse?.id || null,
      couponCode: code,
      percent: next.percent,
      timestamp: Date.now(),
    });
  }, [activeCourse?.id, analytics, couponPercent, couponQuery, tt]);

  const addBundle = useCallback(() => {
    const next: BundleItem = {
      id: `bundle-${Date.now()}`,
      title: `New Bundle ${bundleItems.length + 1}`,
      monthlyPrice: Math.max(99, Math.round(monthlyPrice * 0.9)),
      subscribers: 0,
      description: 'New bundle draft. Configure lessons and access tiers.',
      tier: 'pro',
    };
    setBundleItems((prev) => [...prev, next]);
    setSaveMessage(tt(`Pakke ${next.title} lagt til.`, `Bundle ${next.title} added.`));
  }, [bundleItems.length, monthlyPrice, tt]);

  const removeCoupon = useCallback((couponId: string) => {
    setCouponItems((prev) => prev.filter((coupon) => coupon.id !== couponId));
  }, []);

  const handleSave = useCallback(
    async (publish: boolean) => {
      setSaveMessage('');
      const course = activeCourse;

      const resolvedPrice =
        pricingModel === 'subscription' ? monthlyPrice : pricingModel === 'bundle' ? bundlePrice : oneTimePrice;

      const payload = {
        courseId: course?.id || 'local-preview',
        pricingModel,
        oneTimePrice,
        monthlyPrice,
        annualPrice,
        bundlePrice,
        platformShare,
        creatorShare: 100 - platformShare,
        coupons: couponItems,
        bundles: bundleItems,
        publish,
      };

      try {
        const existing = course ? state.courses.find((entry) => entry.id === course.id) : undefined;

        if (existing) {
          await updateCourse({
            ...existing,
            price: resolvedPrice,
            isFree: resolvedPrice <= 0,
            isPublished: publish ? true : existing.isPublished,
            tags: Array.from(new Set([...(existing.tags || []), 'monetization'])),
          });
        }

        onSave?.(payload);
        setSaveMessage(
          publish
            ? tt('Monetisering publisert.', 'Monetization published.')
            : tt('Monetisering lagret.', 'Monetization saved.'),
        );

        analytics.trackEvent('academy_monetization_saved', {
          courseId: course?.id || null,
          publish,
          pricingModel,
          resolvedPrice,
          timestamp: Date.now(),
        });
      } catch (error) {
        setSaveMessage(
          error instanceof Error
            ? error.message
            : tt('Kunne ikke lagre monetiseringsinnstillinger.', 'Could not save monetization settings.'),
        );
      }
    },
    [
      activeCourse,
      annualPrice,
      bundleItems,
      bundlePrice,
      couponItems,
      monthlyPrice,
      onSave,
      oneTimePrice,
      platformShare,
      pricingModel,
      state.courses,
      tt,
      updateCourse,
      analytics,
    ],
  );

  const leftNavItems = [
    { id: 'overview', label: navLabel('Overview'), route: '/academy-dashboard' },
    { id: 'curriculum', label: navLabel('Curriculum'), route: '/academy/curriculum' },
    { id: 'lessons', label: navLabel('Lessons'), route: '/academy/lesson-editor' },
    { id: 'media', label: navLabel('Media'), route: '/academy/media' },
    { id: 'assignments', label: navLabel('Assignments'), route: '/academy/assignments' },
    { id: 'analytics', label: navLabel('Analytics'), route: '/academy/analytics' },
    { id: 'cta', label: navLabel('CTA Overlay'), route: '/academy/cta-overlay' },
    { id: 'lower-thirds', label: navLabel('Animated Lower Thirds'), route: '/academy/lower-thirds' },
    { id: 'monetization', label: navLabel('Monetization'), route: '/academy/monetization' },
    { id: 'settings', label: navLabel('Settings'), route: '/academy/course-creator' },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: '#edf0f7',
        bgcolor: '#06080d',
        fontFamily: '"Manrope", "Segoe UI", sans-serif',
        position: 'relative',
        overflow: 'hidden',
        '@keyframes goldPulse': {
          '0%': { opacity: 0.55, transform: 'scale(1)' },
          '50%': { opacity: 0.9, transform: 'scale(1.01)' },
          '100%': { opacity: 0.55, transform: 'scale(1)' },
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 74% 12%, rgba(248,179,33,0.25), rgba(5,8,13,0) 39%), radial-gradient(circle at 15% 84%, rgba(83,118,193,0.17), rgba(6,8,14,0) 43%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 26%)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        <Box
          component="aside"
          sx={{
            width: { xs: '100%', lg: 252 },
            borderRight: { xs: 'none', lg: '1px solid rgba(255,255,255,0.08)' },
            borderBottom: { xs: '1px solid rgba(255,255,255,0.08)', lg: 'none' },
            background: 'linear-gradient(180deg, rgba(10,13,22,0.95), rgba(8,10,16,0.96))',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Stack spacing={2} sx={{ px: 2.5, py: 2.4 }}>
            <AcademyBrandMark />
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => setLocation('/academy/course-creator')}
              sx={{
                justifyContent: 'flex-start',
                borderColor: 'rgba(248,179,33,0.55)',
                color: '#f8d56f',
                borderRadius: 1,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {tt('Opprett nytt kurs', 'Create New Course')}
            </Button>
          </Stack>

          <Stack spacing={0.5} sx={{ px: 1.5 }}>
            {leftNavItems.map((item) => {
              const active = leftNav === item.id;
              return (
                <Button
                  key={item.id}
                  onClick={() => {
                    setLeftNav(item.id);
                    setLocation(item.route);
                  }}
                  sx={{
                    justifyContent: 'flex-start',
                    color: active ? '#fce3a1' : 'rgba(237,240,247,0.82)',
                    borderRadius: 1,
                    textTransform: 'none',
                    px: 2,
                    py: 1.15,
                    border: active ? '1px solid rgba(248,179,33,0.35)' : '1px solid transparent',
                    background: active
                      ? 'linear-gradient(90deg, rgba(248,179,33,0.22), rgba(248,179,33,0.04))'
                      : 'transparent',
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>

          <Box sx={{ mt: 'auto', p: 2 }}>
            <Button
              startIcon={<Add />}
              onClick={addBundle}
              sx={{
                width: '100%',
                justifyContent: 'flex-start',
                textTransform: 'none',
                color: '#edf0f7',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 1,
              }}
            >
              {tt('Ny pakke', 'New Bundle')}
            </Button>
          </Box>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              height: 74,
              px: 3,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))',
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography sx={{ letterSpacing: '0.22em', fontSize: 15, color: 'rgba(237,240,247,0.82)' }}>
                CREATOR STUDIO
              </Typography>
              <Chip
                label={tt('Utkast', 'Draft')}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7', fontWeight: 600 }}
              />
            </Stack>

            <Stack direction="row" spacing={1.2} alignItems="center">
              <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.75)' }}>
                <NotificationsNone fontSize="small" />
              </IconButton>
              <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.75)' }}>
                <MailOutline fontSize="small" />
              </IconButton>
              <Avatar sx={{ width: 34, height: 34, bgcolor: '#f8b321', color: '#111' }}>
                N
              </Avatar>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 380px' },
              gap: 2,
              px: 2,
              py: 2,
            }}
          >
            <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.4 }}>
              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', lg: 'center' }}
              >
                <Typography sx={{ fontSize: 38, fontWeight: 600, letterSpacing: '0.02em' }}>
                  {tt('Monetisering', 'Monetization')}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    startIcon={<PlayArrow />}
                    onClick={() => setLocation('/academy/video-player')}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    {tt('Forhåndsvis', 'Preview')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Save />}
                    onClick={() => void handleSave(false)}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    {tt('Lagre', 'Save')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Campaign />}
                    onClick={() => setLocation('/academy/cta-overlay')}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    CTA
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Subtitles />}
                    onClick={() => setLocation('/academy/lower-thirds')}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    {tt('LowerThirds', 'LowerThirds')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Publish />}
                    onClick={() => void handleSave(true)}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 1,
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      boxShadow: '0 10px 24px rgba(248,179,33,0.28)',
                    }}
                  >
                    {tt('Publiser', 'Publish')}
                  </Button>
                </Stack>
              </Stack>

              {!!saveMessage && (
                <Typography
                  sx={{
                    px: 1.2,
                    py: 0.8,
                    borderRadius: 1,
                    border: '1px solid rgba(248,179,33,0.34)',
                    color: '#f8d56f',
                    bgcolor: 'rgba(248,179,33,0.08)',
                  }}
                >
                  {saveMessage}
                </Typography>
              )}

              <Box sx={{ ...panelSx, p: 1.2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
                  <Typography sx={{ fontSize: 28, fontFamily: 'Barlow Condensed, sans-serif' }}>
                    {tt('Inntektsoversikt', 'Earnings Overview')}
                  </Typography>
                  <Stack direction="row" spacing={0.6}>
                    {(['7d', '30d', '90d'] as const).map((option) => (
                      <Button
                        key={option}
                        onClick={() => setRange(option)}
                        sx={{
                          minWidth: 50,
                          textTransform: 'none',
                          color: range === option ? '#0f0f0f' : 'rgba(237,240,247,0.8)',
                          background:
                            range === option
                              ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                              : 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.12)',
                        }}
                      >
                        {option}
                      </Button>
                    ))}
                  </Stack>
                </Stack>

                <Box
                  sx={{
                    borderRadius: 1.2,
                    border: '1px solid rgba(255,255,255,0.08)',
                    p: 1.3,
                    background:
                      'linear-gradient(145deg, rgba(16,19,29,0.92), rgba(10,13,20,0.95)), radial-gradient(circle at 62% 18%, rgba(248,179,33,0.21), rgba(0,0,0,0))',
                  }}
                >
                  <Typography sx={{ fontSize: 56, fontFamily: 'Barlow Condensed, sans-serif', color: '#f8d56f', lineHeight: 1 }}>
                    {toNok(totalEarnings)}
                  </Typography>
                  <Typography sx={{ color: '#7eea8e', letterSpacing: '0.08em', fontSize: 14 }}>
                    {tt('PROGNOSTISERT INNTEKT', 'PROJECTED EARNINGS')}
                  </Typography>

                  <Box
                    sx={{
                      mt: 1.3,
                      height: 260,
                      borderRadius: 1.1,
                      position: 'relative',
                      overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background:
                        'repeating-linear-gradient(to right, rgba(255,255,255,0.04) 0 1px, transparent 1px 52px), repeating-linear-gradient(to top, rgba(255,255,255,0.04) 0 1px, transparent 1px 42px), linear-gradient(180deg, rgba(13,17,26,0.95), rgba(9,12,19,0.95))',
                    }}
                  >
                    <Box
                      component="svg"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                    >
                      <defs>
                        <linearGradient id="earningsStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#f6a50f" />
                          <stop offset="100%" stopColor="#ffdd78" />
                        </linearGradient>
                        <linearGradient id="earningsFill" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgba(248,179,33,0.3)" />
                          <stop offset="100%" stopColor="rgba(248,179,33,0.04)" />
                        </linearGradient>
                      </defs>
                      <polyline
                        fill="none"
                        stroke="url(#earningsStroke)"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={chartPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                      />
                      <polygon
                        fill="url(#earningsFill)"
                        points={`0,100 ${chartPoints.map((point) => `${point.x},${point.y}`).join(' ')} 100,100`}
                      />
                      {chartPoints.map((point) => (
                        <circle
                          key={point.label}
                          cx={point.x}
                          cy={point.y}
                          r="1.25"
                          fill="#ffd44e"
                          style={{ filter: 'drop-shadow(0 0 3px rgba(248,179,33,0.65))' }}
                        />
                      ))}
                    </Box>
                  </Box>

                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.1, px: 0.2 }}>
                    {chartPoints.map((point) => (
                      <Typography
                        key={`label-${point.label}`}
                        sx={{ fontSize: 12, color: 'rgba(237,240,247,0.58)', letterSpacing: '0.03em' }}
                      >
                        {point.label}
                      </Typography>
                    ))}
                  </Stack>
                </Box>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} sx={{ mt: 1.2 }}>
                  {[
                    ['Blocks Sold', formatCompact(totalStudents), `Up ${Math.min(78, 18 + courseRows.length * 4)}%`],
                    ['Average Revenue Per User', toNok(arpu), `Platform ${platformShare}%`],
                    ['Monthly Recurring Revenue', toNok(mrr), `Up ${Math.min(70, 21 + bundleItems.length * 6)}%`],
                  ].map(([title, value, meta]) => (
                    <Box
                      key={title}
                      sx={{
                        ...panelSx,
                        flex: 1,
                        p: 1.2,
                        background: 'linear-gradient(145deg, rgba(14,18,28,0.95), rgba(10,13,20,0.95))',
                      }}
                    >
                      <Typography sx={{ color: 'rgba(237,240,247,0.74)', fontSize: 13 }}>{title}</Typography>
                      <Typography sx={{ fontSize: 36, lineHeight: 1.1, fontFamily: 'Barlow Condensed, sans-serif' }}>
                        {value}
                      </Typography>
                      <Typography sx={{ color: '#7eea8e', fontSize: 13 }}>{meta}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>

              <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.3} sx={{ minHeight: 0 }}>
                <Box sx={{ ...panelSx, flex: 1, p: 1.2 }}>
                  <Typography sx={{ fontSize: 28, fontFamily: 'Barlow Condensed, sans-serif', mb: 1 }}>
                    Top Courses
                  </Typography>

                  <TextField
                    fullWidth
                    size="small"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Search courses..."
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search sx={{ color: 'rgba(237,240,247,0.52)' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 1.1,
                      '& .MuiOutlinedInput-root': {
                        color: '#edf0f7',
                        borderRadius: 1,
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.16)' },
                      },
                    }}
                  />

                  <Stack spacing={1.1}>
                    {filteredRows.slice(0, 3).map((course, index) => (
                      <Box
                        key={course.id}
                        sx={{
                          borderRadius: 1.1,
                          border: '1px solid rgba(255,255,255,0.12)',
                          overflow: 'hidden',
                          background:
                            index % 2 === 0
                              ? 'linear-gradient(120deg, rgba(10,13,21,0.95), rgba(22,26,37,0.9))'
                              : 'linear-gradient(120deg, rgba(12,14,22,0.95), rgba(18,25,35,0.9))',
                        }}
                      >
                        <Stack direction="row" spacing={1.2} sx={{ p: 1.1 }}>
                          <Box
                            sx={{
                              width: 132,
                              minWidth: 132,
                              borderRadius: 0.8,
                              border: '1px solid rgba(255,255,255,0.1)',
                              background:
                                'radial-gradient(circle at 78% 20%, rgba(248,179,33,0.4), rgba(11,14,22,0)), linear-gradient(145deg, rgba(34,39,51,0.94), rgba(10,13,20,0.94))',
                              animation: 'goldPulse 4.8s ease-in-out infinite',
                            }}
                          />

                          <Stack sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontSize: 28, lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }}>
                              {course.title}
                            </Typography>
                            <Typography sx={{ color: 'rgba(237,240,247,0.67)', fontSize: 13 }}>
                              {course.tags.slice(0, 3).join(' · ') || 'Filmmaking'}
                            </Typography>

                            <Stack direction="row" spacing={0.8} sx={{ mt: 0.8 }}>
                              <Chip
                                size="small"
                                label={index === 0 ? 'Bestseller' : 'Advanced'}
                                sx={{ bgcolor: 'rgba(248,179,33,0.2)', color: '#f8d56f' }}
                              />
                              <Chip
                                size="small"
                                label={`${course.students} students`}
                                sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                              />
                            </Stack>

                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.9 }}>
                              <Typography sx={{ fontSize: 34, lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }}>
                                {toNok(course.revenue)}
                              </Typography>
                              <Typography sx={{ color: '#7eea8e', fontSize: 12 }}>Net</Typography>
                              <Typography sx={{ ml: 'auto', color: 'rgba(237,240,247,0.65)', fontSize: 12 }}>
                                {toNok(course.price)} per course
                              </Typography>
                            </Stack>
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, width: { xs: '100%', xl: 430 }, p: 1.2 }}>
                  <Typography sx={{ fontSize: 28, fontFamily: 'Barlow Condensed, sans-serif', mb: 1 }}>
                    Subscriptions & Bundles
                  </Typography>
                  <Stack spacing={1}>
                    {bundleItems.map((bundle) => (
                      <Box
                        key={bundle.id}
                        sx={{
                          borderRadius: 1.1,
                          border: '1px solid rgba(255,255,255,0.12)',
                          p: 1.1,
                          background:
                            bundle.tier === 'elite'
                              ? 'linear-gradient(125deg, rgba(25,16,6,0.94), rgba(11,13,20,0.95))'
                              : 'linear-gradient(125deg, rgba(14,18,27,0.95), rgba(8,11,18,0.94))',
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography sx={{ fontSize: 30, lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }}>
                            {bundle.title}
                          </Typography>
                          <Chip
                            size="small"
                            label={bundle.tier.toUpperCase()}
                            sx={{ bgcolor: alpha('#f8b321', 0.2), color: '#f8d56f', letterSpacing: '0.06em' }}
                          />
                        </Stack>
                        <Typography sx={{ color: 'rgba(237,240,247,0.67)', fontSize: 13, mt: 0.4 }}>
                          {bundle.description}
                        </Typography>
                        <Stack direction="row" spacing={1.1} alignItems="end" sx={{ mt: 0.9 }}>
                          <Typography sx={{ fontSize: 38, lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }}>
                            {toNok(bundle.monthlyPrice)}
                          </Typography>
                          <Typography sx={{ color: 'rgba(237,240,247,0.65)', mb: 0.35 }}>/ month</Typography>
                          <Typography sx={{ ml: 'auto', color: 'rgba(237,240,247,0.67)', fontSize: 13 }}>
                            {bundle.subscribers} subscribers
                          </Typography>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>

                  <Button
                    fullWidth
                    startIcon={<Add />}
                    onClick={addBundle}
                    sx={{
                      mt: 1.2,
                      textTransform: 'none',
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      borderRadius: 1,
                      fontWeight: 700,
                    }}
                  >
                    Add Bundle
                  </Button>
                </Box>
              </Stack>
            </Box>

            <Box sx={{ ...panelSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Tabs
                value={rightTab}
                onChange={(_, value: RightTab) => setRightTab(value)}
                textColor="inherit"
                sx={{
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  '& .MuiTabs-indicator': { backgroundColor: '#f8b321' },
                  '& .MuiTab-root': { color: 'rgba(237,240,247,0.78)', textTransform: 'none', minHeight: 44 },
                  '& .Mui-selected': { color: '#f7f8fb' },
                }}
              >
                <Tab value="monetization" label={tt('Monetisering', 'Monetization')} />
                <Tab value="pricing" label={tt('Prising', 'Pricing')} />
                <Tab value="concierges" label={tt('Concierge', 'Concierges')} />
              </Tabs>

              <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1.2 }}>
                {rightTab === 'monetization' && (
                  <Stack spacing={1.1}>
                    <Box sx={{ ...panelSx, p: 1.1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography sx={{ fontSize: 22, fontFamily: 'Barlow Condensed, sans-serif' }}>
                          Pricing
                        </Typography>
                        <Select
                          size="small"
                          value={pricingModel}
                          onChange={(event) => setPricingModel(event.target.value as PricingModel)}
                          sx={{
                            minWidth: 136,
                            color: '#edf0f7',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                          }}
                        >
                          <MenuItem value="one_time">One-time</MenuItem>
                          <MenuItem value="subscription">Subscription</MenuItem>
                          <MenuItem value="bundle">Bundle</MenuItem>
                        </Select>
                      </Stack>

                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Current Price</Typography>
                        <Typography sx={{ fontWeight: 700 }}>{toNok(oneTimePrice)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.55 }}>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Coupons</Typography>
                        <Typography sx={{ color: '#f8d56f' }}>{couponItems.length} active</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.55 }}>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>MRR</Typography>
                        <Typography sx={{ color: '#7eea8e' }}>{toNok(mrr)}</Typography>
                      </Stack>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1.1 }}>
                      <Typography sx={{ fontSize: 22, fontFamily: 'Barlow Condensed, sans-serif' }}>
                        Revenue Split
                      </Typography>

                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.9 }}>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Creator</Typography>
                        <Typography sx={{ color: '#f8d56f' }}>{100 - platformShare}%</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.3 }}>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Platform</Typography>
                        <Typography>{platformShare}%</Typography>
                      </Stack>

                      <Slider
                        min={5}
                        max={50}
                        step={1}
                        value={platformShare}
                        onChange={(_, value) => {
                          const next = Array.isArray(value) ? value[0] : value;
                          setPlatformShare(next);
                        }}
                        sx={{
                          mt: 0.9,
                          color: '#f8b321',
                          '& .MuiSlider-thumb': {
                            width: 13,
                            height: 13,
                          },
                        }}
                      />
                    </Box>

                    <Box sx={{ ...panelSx, p: 1.1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography sx={{ fontSize: 22, fontFamily: 'Barlow Condensed, sans-serif' }}>
                          Payouts
                        </Typography>
                        <Chip label="Weekly" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }} />
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.85 }}>
                        <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>Next payout</Typography>
                        <Typography sx={{ color: '#f8d56f' }}>{toNok(Math.round(mrr * 0.27))}</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, 54 + bundleItems.length * 11)}
                        sx={{
                          mt: 1,
                          height: 7,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.14)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 999,
                            background: 'linear-gradient(90deg, #80d66d 0%, #f8b321 100%)',
                          },
                        }}
                      />
                    </Box>

                    <Box sx={{ ...panelSx, p: 1.1 }}>
                      <Typography sx={{ fontSize: 22, fontFamily: 'Barlow Condensed, sans-serif', mb: 1 }}>
                        Affiliates
                      </Typography>
                      {[
                        ['Alex Jensen', 100],
                        ['Emma Berg', 74],
                        ['Lina Hoist', 42],
                      ].map(([name, ratio]) => (
                        <Stack key={name} spacing={0.45} sx={{ mb: 0.8 }}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography sx={{ color: 'rgba(237,240,247,0.82)' }}>{name}</Typography>
                            <Typography sx={{ color: '#7eea8e' }}>{ratio}%</Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={Number(ratio)}
                            sx={{
                              height: 6,
                              borderRadius: 999,
                              bgcolor: 'rgba(255,255,255,0.14)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 999,
                                background:
                                  Number(ratio) > 80
                                    ? 'linear-gradient(90deg, #8ce171 0%, #f8b321 100%)'
                                    : 'linear-gradient(90deg, #5ca8df 0%, #f8b321 100%)',
                              },
                            }}
                          />
                        </Stack>
                      ))}
                    </Box>
                  </Stack>
                )}

                {rightTab === 'pricing' && (
                  <Stack spacing={1.1}>
                    <Box sx={{ ...panelSx, p: 1.1 }}>
                      <Typography sx={{ fontSize: 22, fontFamily: 'Barlow Condensed, sans-serif', mb: 0.8 }}>
                        Course Pricing
                      </Typography>
                      <Select
                        fullWidth
                        size="small"
                        value={selectedCourseId}
                        onChange={(event) => setSelectedCourseId(String(event.target.value))}
                        sx={{
                          mb: 1,
                          color: '#edf0f7',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                        }}
                      >
                        {courseItems.map((course) => (
                          <MenuItem key={course.id} value={course.id}>
                            {course.title}
                          </MenuItem>
                        ))}
                      </Select>

                      <Stack spacing={0.9}>
                        <TextField
                          size="small"
                          type="number"
                          label="One-time price (NOK)"
                          value={oneTimePrice}
                          onChange={(event) => setOneTimePrice(Math.max(0, Number(event.target.value) || 0))}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <AttachMoney sx={{ color: 'rgba(237,240,247,0.56)' }} />
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#edf0f7',
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.16)' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.58)' },
                          }}
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="Monthly subscription"
                          value={monthlyPrice}
                          onChange={(event) => setMonthlyPrice(Math.max(0, Number(event.target.value) || 0))}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#edf0f7',
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.16)' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.58)' },
                          }}
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="Annual plan"
                          value={annualPrice}
                          onChange={(event) => setAnnualPrice(Math.max(0, Number(event.target.value) || 0))}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#edf0f7',
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.16)' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.58)' },
                          }}
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="Bundle ticket"
                          value={bundlePrice}
                          onChange={(event) => setBundlePrice(Math.max(0, Number(event.target.value) || 0))}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#edf0f7',
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.16)' },
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.58)' },
                          }}
                        />
                      </Stack>
                    </Box>

                    <Box sx={{ ...panelSx, p: 1.1 }}>
                      <Typography sx={{ fontSize: 22, fontFamily: 'Barlow Condensed, sans-serif', mb: 0.8 }}>
                        Coupons
                      </Typography>
                      <Stack direction="row" spacing={0.8}>
                        <TextField
                          size="small"
                          value={couponQuery}
                          onChange={(event) => setCouponQuery(event.target.value)}
                          placeholder="Coupon code"
                          sx={{
                            flex: 1,
                            '& .MuiOutlinedInput-root': {
                              color: '#edf0f7',
                              '& fieldset': { borderColor: 'rgba(255,255,255,0.16)' },
                            },
                          }}
                        />
                        <Select
                          size="small"
                          value={couponPercent}
                          onChange={(event) => setCouponPercent(Number(event.target.value))}
                          sx={{
                            width: 92,
                            color: '#edf0f7',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                          }}
                        >
                          {[10, 15, 20, 25, 30, 40].map((value) => (
                            <MenuItem key={value} value={value}>
                              {value}%
                            </MenuItem>
                          ))}
                        </Select>
                        <Button
                          startIcon={<LocalOffer />}
                          onClick={createCoupon}
                          sx={{
                            textTransform: 'none',
                            color: '#0f0f0f',
                            background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                          }}
                        >
                          Add
                        </Button>
                      </Stack>

                      <Stack spacing={0.6} sx={{ mt: 1 }}>
                        {couponItems.map((coupon) => (
                          <Stack
                            key={coupon.id}
                            direction="row"
                            alignItems="center"
                            spacing={0.8}
                            sx={{
                              px: 0.8,
                              py: 0.6,
                              borderRadius: 1,
                              border: '1px solid rgba(255,255,255,0.11)',
                              background: coupon.active ? 'rgba(248,179,33,0.09)' : 'rgba(255,255,255,0.03)',
                            }}
                          >
                            <Chip size="small" label={`${coupon.percent}%`} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }} />
                            <Typography sx={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700 }}>{coupon.code}</Typography>
                            <Typography sx={{ ml: 'auto', color: 'rgba(237,240,247,0.62)', fontSize: 12 }}>
                              {coupon.usage} used
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => removeCoupon(coupon.id)}
                              sx={{ color: 'rgba(237,240,247,0.62)' }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  </Stack>
                )}

                {rightTab === 'concierges' && (
                  <Stack spacing={1.1}>
                    <Box sx={{ ...panelSx, p: 1.1 }}>
                      <Typography sx={{ fontSize: 24, fontFamily: 'Barlow Condensed, sans-serif' }}>
                        Concierge Programs
                      </Typography>
                      <Typography sx={{ color: 'rgba(237,240,247,0.7)', mt: 0.6 }}>
                        Dedicated onboarding and partner campaigns for premium launches.
                      </Typography>
                    </Box>

                    {[
                      ['Launch Concierge', 'Managed launch campaigns and sponsored placement.', 86],
                      ['Affiliate Concierge', 'High-tier affiliate recruiting and tracking ops.', 64],
                      ['Enterprise Concierge', 'Corporate licensing and private cohorts.', 48],
                    ].map(([title, details, progress]) => (
                      <Box key={title} sx={{ ...panelSx, p: 1.1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography sx={{ fontSize: 23, fontFamily: 'Barlow Condensed, sans-serif' }}>{title}</Typography>
                          <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.68)' }}>
                            <MoreHoriz fontSize="small" />
                          </IconButton>
                        </Stack>
                        <Typography sx={{ color: 'rgba(237,240,247,0.7)', fontSize: 13, mt: 0.5 }}>
                          {details}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Number(progress)}
                          sx={{
                            mt: 1,
                            height: 6,
                            borderRadius: 999,
                            bgcolor: 'rgba(255,255,255,0.14)',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 999,
                              background: 'linear-gradient(90deg, #5ea4f5 0%, #f8b321 100%)',
                            },
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              <Stack direction="row" spacing={1} sx={{ p: 1.1 }}>
                <Button
                  startIcon={<MonetizationOn />}
                  onClick={() => setRightTab('monetization')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  Revenue
                </Button>
                <Button
                  startIcon={<Save />}
                  onClick={() => void handleSave(false)}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  Save
                </Button>
                <Button
                  onClick={() => {
                    if (onCancel) {
                      onCancel();
                    } else {
                      setLocation('/academy/course-creator');
                    }
                  }}
                  sx={{
                    textTransform: 'none',
                    color: 'rgba(237,240,247,0.76)',
                    border: '1px solid rgba(255,255,255,0.16)',
                  }}
                >
                  Close
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyMonetizationStudio, {
  componentId: 'academy-monetization-studio',
  componentName: 'Academy Monetization Studio',
  componentType: 'dashboard',
  componentCategory: 'academy',
  featureIds: ['academy-monetization', 'academy-coupons', 'academy-pricing', 'academy-revenue'],
});
