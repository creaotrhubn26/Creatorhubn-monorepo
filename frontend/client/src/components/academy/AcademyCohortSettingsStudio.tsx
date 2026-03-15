import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  Assessment,
  Campaign,
  Download,
  Edit,
  Lock,
  MailOutline,
  MonetizationOn,
  MoreHoriz,
  NotificationsNone,
  Publish,
  Save,
  Search,
  Subtitles,
  TrendingUp,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { academyPdfExportService } from '@/services/academyPdfExportService';
import { useAcademyLocale } from './academyLocale';
import AcademyLocaleSwitcher from './AcademyLocaleSwitcher';
import AcademyLeftSidebar from './AcademyLeftSidebar';

interface AcademyCohortSettingsStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type CohortStatus = 'active' | 'closed' | 'early_access' | 'invitation_only';

type CohortFilter = 'all' | CohortStatus;

interface CohortItem {
  id: string;
  name: string;
  subtitle: string;
  startDate: string;
  endDate: string;
  enrollments: number;
  capacity: number;
  completionRate: number;
  revenue: number;
  status: CohortStatus;
  tags: string[];
  imageTheme: number;
}

interface DiscussionItem {
  id: string;
  author: string;
  message: string;
  timestamp: string;
}

interface CohortSettingsPayload {
  courseId: string;
  cohorts: CohortItem[];
  featureFlags: {
    earlyAccess: boolean;
    invitationOnly: boolean;
    closed: boolean;
    dripRelease: boolean;
  };
  selectedCohortId: string | null;
  discussions: DiscussionItem[];
}

interface CohortSettingsResponse {
  success: boolean;
  data: CohortSettingsPayload | null;
}

const panelSx = {
  borderRadius: 1.4,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const placeholderBackgrounds = [
  'linear-gradient(145deg, rgba(24,30,42,0.92), rgba(12,16,24,0.98)), radial-gradient(circle at 85% 16%, rgba(245,166,35,0.34), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(18,23,34,0.95), rgba(10,14,21,0.98)), radial-gradient(circle at 12% 82%, rgba(245,166,35,0.24), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(17,21,31,0.94), rgba(8,12,18,0.98)), radial-gradient(circle at 72% 10%, rgba(114,158,225,0.2), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(19,24,36,0.93), rgba(11,14,22,0.98)), radial-gradient(circle at 70% 22%, rgba(248,179,33,0.22), rgba(0,0,0,0))',
];


const defaultFeatureFlags = {
  earlyAccess: true,
  invitationOnly: true,
  closed: true,
  dripRelease: false,
};

const formatDateRange = (startDate: string, endDate: string, locale: 'nb-NO' | 'en-US'): string => {
  const format = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  return `${format(startDate)} - ${format(endDate)}`;
};

const toNok = (value: number): string =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

function AcademyCohortSettingsStudio({ courseId, onSave, onCancel }: AcademyCohortSettingsStudioProps) {
  const [location, setLocation] = useLocation();
  const { state, getCourse, updateCourse, setCurrentCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();
  
  const { navLabel, tt, language } = useAcademyLocale();
  const dateLocale: 'nb-NO' | 'en-US' = language === 'no' ? 'nb-NO' : 'en-US';

  const [leftNav, setLeftNav] = useState('cohort');
  const [filter, setFilter] = useState<CohortFilter>('all');
  const [searchValue, setSearchValue] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || '');
  const [saveMessage, setSaveMessage] = useState('');
  const [isHydratingCohorts, setIsHydratingCohorts] = useState(false);
  const [isPersistingCohorts, setIsPersistingCohorts] = useState(false);
  const cohortAutoSaveTimerRef = useRef<number | null>(null);
  const hasLoadedCourseSettingsRef = useRef(false);

  const [cohortItems, setCohortItems] = useState<CohortItem[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [discussionItems, setDiscussionItems] = useState<DiscussionItem[]>([]);
  const [discussionAuthor, setDiscussionAuthor] = useState(() => tt('Du', 'You'));
  const [discussionDraft, setDiscussionDraft] = useState('');

  const [featureFlags, setFeatureFlags] = useState(defaultFeatureFlags);

  const [tagDraft, setTagDraft] = useState('');

  const localizedStatusLabel = useCallback(
    (status: CohortStatus): string => {
      if (status === 'early_access') return tt('Tidlig tilgang', 'Early Access');
      if (status === 'invitation_only') return tt('Kun invitasjon', 'Invitation Only');
      if (status === 'closed') return tt('Lukket', 'Closed');
      return tt('Aktiv', 'Active');
    },
    [tt],
  );

  const courseItems = useMemo(() => {
    if (Array.isArray(state.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return [];
  }, [state.courses]);

  const courseOptionIds = useMemo(
    () => courseItems.map((course) => String(course.id)),
    [courseItems],
  );

  const activeCourse = useMemo(() => {
    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;

    const fromSelected = selectedCourseId
      ? courseItems.find((course) => String(course.id) === String(selectedCourseId))
      : null;
    if (fromSelected) return fromSelected;

    return state.currentCourse || courseItems[0] || null;
  }, [courseId, courseItems, getCourse, selectedCourseId, state.currentCourse]);

  const syncCourseIdInRoute = useCallback(
    (nextCourseId: string) => {
      const normalizedCourseId = String(nextCourseId || '').trim();
      const [pathname, rawQuery = ''] = location.split('?');
      const params = new URLSearchParams(rawQuery);

      if (normalizedCourseId && normalizedCourseId !== 'all') {
        params.set('courseId', normalizedCourseId);
      } else {
        params.delete('courseId');
      }
      params.delete('course_id');

      const suffix = params.toString();
      setLocation(suffix ? `${pathname}?${suffix}` : pathname);
    },
    [location, setLocation],
  );

  useEffect(() => {
    const nextCourseId = String(courseId || '').trim();
    if (!nextCourseId) return;
    setSelectedCourseId((previousCourseId) =>
      previousCourseId === nextCourseId ? previousCourseId : nextCourseId,
    );
  }, [courseId]);

  useEffect(() => {
    if (!activeCourse?.id) return;
    const inState = state.courses.some((course) => String(course.id) === String(activeCourse.id));
    if (!inState) return;
    if (String(state.currentCourse?.id || '') === String(activeCourse.id)) return;
    setCurrentCourse(activeCourse);
  }, [activeCourse, setCurrentCourse, state.courses, state.currentCourse?.id]);

  const selectedCourseValue = useMemo(() => {
    const preferredId = String(selectedCourseId || activeCourse?.id || '');
    if (preferredId && courseOptionIds.includes(preferredId)) {
      return preferredId;
    }
    return courseOptionIds[0] || '';
  }, [activeCourse?.id, courseOptionIds, selectedCourseId]);

  useEffect(() => {
    if (!selectedCourseId && activeCourse?.id) {
      setSelectedCourseId(String(activeCourse.id));
    }
  }, [activeCourse?.id, selectedCourseId]);

  useEffect(() => {
    if (selectedCourseValue && selectedCourseId !== selectedCourseValue) {
      setSelectedCourseId(selectedCourseValue);
    }
  }, [selectedCourseId, selectedCourseValue]);

  const persistCohortDraft = useCallback(
    async (publish: boolean, silent: boolean): Promise<boolean> => {
      const targetCourseId = String(selectedCourseValue || activeCourse?.id || '').trim();
      if (!targetCourseId) {
        if (!silent) {
          setSaveMessage(tt('Velg en kompetanse før lagring.', 'Select a competency before saving.'));
        }
        return false;
      }

      const payload: CohortSettingsPayload = {
        courseId: targetCourseId,
        cohorts: cohortItems,
        featureFlags,
        selectedCohortId: selectedCohortId || null,
        discussions: discussionItems,
      };

      if (!silent) {
        setIsPersistingCohorts(true);
      }

      try {
        const response = await fetch('/api/academy/cohort-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...payload,
            publish,
          }),
        });

        if (!response.ok) {
          throw new Error(
            tt('Kunne ikke lagre kohortinnstillinger.', 'Could not save cohort settings.'),
          );
        }
        return true;
      } catch (error) {
        if (!silent) {
          const message =
            error instanceof Error
              ? error.message
              : tt('Kunne ikke lagre kohortinnstillinger.', 'Could not save cohort settings.');
          setSaveMessage(message);
        }
        return false;
      } finally {
        if (!silent) {
          setIsPersistingCohorts(false);
        }
      }
    },
    [
      activeCourse?.id,
      cohortItems,
      discussionItems,
      featureFlags,
      selectedCohortId,
      selectedCourseValue,
      tt,
    ],
  );

  const hydrateCohortSettings = useCallback(async () => {
    const targetCourseId = String(selectedCourseValue || '').trim();
    if (!targetCourseId) {
      hasLoadedCourseSettingsRef.current = false;
      setCohortItems([]);
      setDiscussionItems([]);
      setSelectedCohortId('');
      setFeatureFlags(defaultFeatureFlags);
      return;
    }

    setIsHydratingCohorts(true);
    hasLoadedCourseSettingsRef.current = false;

    try {
      const response = await fetch(
        `/api/academy/cohort-settings?courseId=${encodeURIComponent(targetCourseId)}`,
        { credentials: 'include' },
      );
      if (!response.ok) {
        throw new Error(
          tt('Kunne ikke hente kohortinnstillinger.', 'Could not load cohort settings.'),
        );
      }
      const payload = (await response.json().catch(() => null)) as CohortSettingsResponse | null;
      const data = payload?.data;

      setCohortItems(Array.isArray(data?.cohorts) ? data.cohorts : []);
      setDiscussionItems(Array.isArray(data?.discussions) ? data.discussions : []);
      setFeatureFlags({
        ...defaultFeatureFlags,
        ...(data?.featureFlags || {}),
      });
      setSelectedCohortId(typeof data?.selectedCohortId === 'string' ? data.selectedCohortId : '');
      setSaveMessage('');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tt('Kunne ikke hente kohortinnstillinger.', 'Could not load cohort settings.');
      setSaveMessage(message);
      setCohortItems([]);
      setDiscussionItems([]);
      setSelectedCohortId('');
      setFeatureFlags(defaultFeatureFlags);
    } finally {
      hasLoadedCourseSettingsRef.current = true;
      setIsHydratingCohorts(false);
    }
  }, [selectedCourseValue, tt]);

  useEffect(() => {
    void hydrateCohortSettings();
  }, [hydrateCohortSettings]);

  useEffect(() => {
    if (!hasLoadedCourseSettingsRef.current) return;
    if (isHydratingCohorts) return;
    if (!selectedCourseValue) return;

    if (cohortAutoSaveTimerRef.current) {
      window.clearTimeout(cohortAutoSaveTimerRef.current);
    }

    cohortAutoSaveTimerRef.current = window.setTimeout(() => {
      void persistCohortDraft(false, true);
    }, 600);

    return () => {
      if (cohortAutoSaveTimerRef.current) {
        window.clearTimeout(cohortAutoSaveTimerRef.current);
        cohortAutoSaveTimerRef.current = null;
      }
    };
  }, [
    cohortItems,
    discussionItems,
    featureFlags,
    isHydratingCohorts,
    persistCohortDraft,
    selectedCohortId,
    selectedCourseValue,
  ]);

  useEffect(() => {
    if (cohortItems.length === 0) {
      if (selectedCohortId) setSelectedCohortId('');
      return;
    }

    const stillExists = cohortItems.some((item) => item.id === selectedCohortId);
    if (!stillExists) {
      setSelectedCohortId(cohortItems[0].id);
    }
  }, [cohortItems, selectedCohortId]);

  useEffect(() => {
    analytics.trackEvent('academy_cohort_settings_opened', {
      courseId: activeCourse?.id || null,
      cohortCount: cohortItems.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'AcademyCohortSettingsStudio opened', {
      courseId: activeCourse?.id || null,
      cohortCount: cohortItems.length,
    });
  }, [activeCourse?.id, analytics, cohortItems.length, debugging]);

  const selectedCohort = useMemo(() => {
    return cohortItems.find((item) => item.id === selectedCohortId) || cohortItems[0] || null;
  }, [cohortItems, selectedCohortId]);

  const visibleCohorts = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return cohortItems.filter((cohort) => {
      const statusMatch = filter === 'all' ? true : cohort.status === filter;
      if (!statusMatch) return false;
      if (!query) return true;
      return (
        cohort.name.toLowerCase().includes(query) ||
        cohort.subtitle.toLowerCase().includes(query) ||
        cohort.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [cohortItems, filter, searchValue]);

  const totalRevenue = useMemo(
    () => cohortItems.reduce((sum, cohort) => sum + cohort.revenue, 0),
    [cohortItems],
  );

  const averageCompletion = useMemo(() => {
    if (cohortItems.length === 0) return 0;
    const total = cohortItems.reduce((sum, cohort) => sum + cohort.completionRate, 0);
    return Math.round(total / cohortItems.length);
  }, [cohortItems]);

  const enrollmentVelocity = useMemo(() => {
    const active = cohortItems.filter((cohort) => cohort.status !== 'closed');
    if (active.length === 0) return 0;
    const currentFill = active.reduce((sum, cohort) => sum + cohort.enrollments / Math.max(cohort.capacity, 1), 0);
    return Number(((currentFill / active.length) * 100).toFixed(1));
  }, [cohortItems]);

  const leaderboard = useMemo(() => {
    return [...cohortItems]
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 3);
  }, [cohortItems]);

  const upcomingCohorts = useMemo(() => {
    return [...cohortItems]
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 3);
  }, [cohortItems]);

  const handleExport = useCallback(async () => {
    if (visibleCohorts.length === 0) {
      setSaveMessage(tt('Ingen kohortdata å eksportere.', 'No cohort data to export.'));
      return;
    }

    const courseLabel = activeCourse?.title || tt('Aktiv kompetanse', 'Active competency');
    await academyPdfExportService.exportReport({
      fileName: `academy-cohorts-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: tt('Kohortinnstillinger', 'Cohort Settings'),
      subtitle: tt(
        'Kohortoversikt, status og fremdrift',
        'Cohort overview, status, and progress',
      ),
      courseLabel,
      locale: language === 'no' ? 'nb-NO' : 'en-US',
      sections: [
        {
          title: tt('Oversikt', 'Overview'),
          metrics: [
            { label: tt('Kohorter', 'Cohorts'), value: cohortItems.length },
            { label: tt('Synlige', 'Visible'), value: visibleCohorts.length },
            { label: tt('Gj.sn. fullføring', 'Avg completion'), value: `${averageCompletion}%` },
            { label: tt('Inntekt', 'Revenue'), value: toNok(totalRevenue) },
          ],
        },
        {
          title: tt('Ytelseshøydepunkter', 'Performance Highlights'),
          table: {
            columns: [tt('Måling', 'Metric'), tt('Verdi', 'Value')],
            rows: [
              [tt('Påmeldingshastighet', 'Enrollment velocity'), `${enrollmentVelocity}%`],
              [tt('Gj.sn. fullføring', 'Avg completion'), `${averageCompletion}%`],
              [tt('Total inntekt', 'Total revenue'), toNok(totalRevenue)],
            ],
          },
        },
        {
          title: tt('Kohortliste', 'Cohort List'),
          table: {
            columns: [
              tt('Kohort', 'Cohort'),
              tt('Periode', 'Period'),
              tt('Påmeldinger', 'Enrollments'),
              tt('Kapasitet', 'Capacity'),
              tt('Fullføring', 'Completion'),
              tt('Status', 'Status'),
              tt('Tagger', 'Tags'),
            ],
            rows: visibleCohorts.map((cohort) => [
              cohort.name,
              formatDateRange(cohort.startDate, cohort.endDate, dateLocale),
              cohort.enrollments,
              cohort.capacity,
              `${cohort.completionRate}%`,
              localizedStatusLabel(cohort.status),
              cohort.tags.join(', ') || '-',
            ]),
          },
        },
        {
          title: tt('Toppliste', 'Leaderboard'),
          table: {
            columns: [
              tt('Kohort', 'Cohort'),
              tt('Fullføring', 'Completion'),
              tt('Påmeldinger', 'Enrollments'),
            ],
            rows: leaderboard.map((cohort) => [
              cohort.name,
              `${cohort.completionRate}%`,
              cohort.enrollments,
            ]),
          },
        },
        {
          title: tt('Kommende kull', 'Upcoming Cohorts'),
          table: {
            columns: [
              tt('Kohort', 'Cohort'),
              tt('Periode', 'Period'),
              tt('Påmeldinger', 'Enrollments'),
            ],
            rows: upcomingCohorts.map((cohort) => [
              cohort.name,
              formatDateRange(cohort.startDate, cohort.endDate, dateLocale),
              cohort.enrollments,
            ]),
          },
        },
      ],
    });

    analytics.trackEvent('academy_cohort_settings_export_clicked', {
      courseId: activeCourse?.id || null,
      cohortCount: visibleCohorts.length,
      timestamp: Date.now(),
    });
    setSaveMessage(tt('Kohortrapport eksportert som PDF.', 'Cohort report exported as PDF.'));
  }, [
    activeCourse?.id,
    activeCourse?.title,
    analytics,
    averageCompletion,
    cohortItems.length,
    dateLocale,
    enrollmentVelocity,
    language,
    leaderboard,
    localizedStatusLabel,
    totalRevenue,
    tt,
    upcomingCohorts,
    visibleCohorts,
  ]);

  const handleReports = useCallback(async () => {
    analytics.trackEvent('academy_cohort_settings_reports_clicked', {
      courseId: activeCourse?.id || null,
      cohortCount: visibleCohorts.length,
      timestamp: Date.now(),
    });
    await handleExport();
  }, [activeCourse?.id, analytics, handleExport, visibleCohorts.length]);

  const addCohort = useCallback(() => {
    if (!selectedCourseValue) {
      setSaveMessage(tt('Velg en kompetanse først.', 'Select a competency first.'));
      return;
    }

    const index = cohortItems.length + 1;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + 1, 8 + index);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, start.getDate() + 10);

    const newCohort: CohortItem = {
      id: `cohort-${Date.now()}`,
      name: `${tt('Nytt kull', 'New Cohort')} ${index}`,
      subtitle: tt('Kompetansefokus · Planlagt', 'Competency track · Scheduled'),
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      enrollments: 0,
      capacity: 100,
      completionRate: 0,
      revenue: 0,
      status: 'active',
      tags: [tt('Kun invitasjon', 'Invitation Only')],
      imageTheme: index % placeholderBackgrounds.length,
    };

    setCohortItems((prev) => [newCohort, ...prev]);
    setSelectedCohortId(newCohort.id);
  }, [cohortItems.length, selectedCourseValue, tt]);

  const updateSelectedCohort = useCallback(
    (patch: Partial<CohortItem>) => {
      if (!selectedCohort) return;
      setCohortItems((prev) =>
        prev.map((item) => (item.id === selectedCohort.id ? { ...item, ...patch } : item)),
      );
    },
    [selectedCohort],
  );

  const removeSelectedCohort = useCallback(
    (cohortId: string) => {
      setCohortItems((prev) => prev.filter((item) => item.id !== cohortId));
      if (selectedCohortId === cohortId) {
        setSelectedCohortId('');
      }
      setSaveMessage(tt('Kohort fjernet.', 'Cohort removed.'));
    },
    [selectedCohortId, tt],
  );

  const openCohortEnrollment = useCallback(
    (cohort: CohortItem) => {
      const params = new URLSearchParams();
      if (selectedCourseValue) params.set('courseId', selectedCourseValue);
      params.set('cohort', cohort.id);
      setLocation(`/academy/enrollment?${params.toString()}`);
    },
    [selectedCourseValue, setLocation],
  );

  const toggleFeatureFlag = useCallback((key: keyof typeof featureFlags) => {
    setFeatureFlags((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const addTagToSelected = useCallback(() => {
    const tag = tagDraft.trim();
    if (!tag || !selectedCohort) return;

    setCohortItems((prev) =>
      prev.map((item) => {
        if (item.id !== selectedCohort.id) return item;
        if (item.tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return item;
        return { ...item, tags: [...item.tags, tag] };
      }),
    );

    setTagDraft('');
  }, [selectedCohort, tagDraft]);

  const removeTagFromSelected = useCallback(
    (tag: string) => {
      if (!selectedCohort) return;
      setCohortItems((prev) =>
        prev.map((item) => {
          if (item.id !== selectedCohort.id) return item;
          return { ...item, tags: item.tags.filter((entry) => entry !== tag) };
        }),
      );
    },
    [selectedCohort],
  );

  const saveCohortSettings = useCallback(
    async (publish: boolean) => {
      const targetCourseId = String(selectedCourseValue || activeCourse?.id || '').trim();
      if (!targetCourseId) {
        setSaveMessage(tt('Velg en kompetanse før lagring.', 'Select a competency before saving.'));
        return;
      }

      const payload = {
        courseId: targetCourseId,
        cohorts: cohortItems,
        featureFlags,
        selectedCohortId,
        discussions: discussionItems,
        publish,
        updatedAt: new Date().toISOString(),
      };

      try {
        const persisted = await persistCohortDraft(publish, false);
        if (!persisted) {
          return;
        }

        if (activeCourse?.id && state.courses.some((course) => String(course.id) === String(activeCourse.id))) {
          const enrichedTags = Array.from(new Set([...(activeCourse.tags || []), 'cohort'])) as string[];
          await updateCourse({
            ...activeCourse,
            tags: enrichedTags,
            updatedAt: new Date().toISOString(),
            isPublished: publish ? true : activeCourse.isPublished,
          });
        }

        setSaveMessage(
          publish
            ? tt('Kohortinnstillinger publisert.', 'Cohort settings published.')
            : tt('Kohortinnstillinger lagret.', 'Cohort settings saved.'),
        );
        onSave?.(payload);

        analytics.trackEvent(publish ? 'academy_cohort_settings_publish' : 'academy_cohort_settings_save', {
          courseId: targetCourseId,
          cohortCount: cohortItems.length,
          publish,
          timestamp: Date.now(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : tt('Kunne ikke lagre kohortinnstillinger.', 'Failed to save cohort settings.');
        setSaveMessage(message);
        debugging.logIntegration('error', 'Academy cohort settings save failed', {
          courseId: activeCourse?.id || null,
          message,
        });
      }
    },
    [
      activeCourse,
      analytics,
      cohortItems,
      discussionItems,
      debugging,
      featureFlags,
      onSave,
      persistCohortDraft,
      selectedCohortId,
      selectedCourseValue,
      state.courses,
      tt,
      updateCourse,
    ],
  );

  const addDiscussion = useCallback(() => {
    const draft = discussionDraft.trim();
    if (!draft) {
      setSaveMessage(tt('Skriv et diskusjonsnotat før publisering.', 'Write a discussion note before posting.'));
      return;
    }

    const newDiscussion: DiscussionItem = {
      id: `discussion-${Date.now()}`,
      author: discussionAuthor.trim() || tt('Du', 'You'),
      message: draft,
      timestamp: tt('nå', 'now'),
    };

    setDiscussionItems((prev) => [newDiscussion, ...prev]);
    setDiscussionDraft('');
    setSaveMessage(tt('Diskusjonsnotat lagt til.', 'Discussion note added.'));
  }, [discussionAuthor, discussionDraft, tt]);

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
          background:
            'radial-gradient(circle at 74% 12%, rgba(248,179,33,0.24), rgba(5,8,13,0) 42%), radial-gradient(circle at 16% 74%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 32%)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, minHeight: '100vh', position: 'relative', zIndex: 1, width: 'min(100%, var(--academy-shell-max-width, 1920px))', mx: 'auto' }}>
        <AcademyLeftSidebar
          activeNav={leftNav}
          onNavigate={(navId, route) => {
            setLeftNav(navId);
            setLocation(route);
          }}
          onCreateCourse={() => {
            setLeftNav('curriculum');
            setLocation('/academy/curriculum?createCompetency=1');
          }}
          tt={tt}
          navLabel={navLabel}
          bottomAction={{
            label: tt('Nytt kull', 'New Cohort'),
            onClick: addCohort,
          }}
        />

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography sx={{ letterSpacing: '0.22em', fontSize: 15, color: 'rgba(237,240,247,0.82)' }}>
                CREATOR STUDIO
              </Typography>
              <Chip
                label={activeCourse?.isPublished ? tt('Publisert', 'Published') : tt('Utkast', 'Draft')}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7', fontWeight: 600 }}
              />
            </Stack>

            <Stack direction="row" spacing={1.2} alignItems="center">
              <AcademyLocaleSwitcher />
              <IconButton
                size="small"
                onClick={() => setLocation('/academy/settings?tab=notifications')}
                aria-label={tt('Varsler', 'Notifications')}
                sx={{ color: 'rgba(237,240,247,0.75)' }}
              >
                <NotificationsNone fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocation('/academy/settings?tab=messages')}
                aria-label={tt('Meldinger', 'Messages')}
                sx={{ color: 'rgba(237,240,247,0.75)' }}
              >
                <MailOutline fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocation('/academy/settings?tab=profile')}
                aria-label={tt('Profil', 'Profile')}
                sx={{ p: 0 }}
              >
                <Avatar sx={{ width: 34, height: 34, bgcolor: '#f8b321', color: '#111' }}>
                  {String(activeCourse?.instructor?.name || 'N').charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 390px' },
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
                <Typography sx={{ fontSize: 26, fontWeight: 600, letterSpacing: '0.02em' }}>
                  {tt('Kohortinnstillinger', 'Cohort Settings')}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={handleExport}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    {tt('Eksporter', 'Export')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Assessment />}
                    onClick={handleReports}
                    sx={{
                      textTransform: 'none',
                      borderColor: 'rgba(255,255,255,0.2)',
                      color: '#edf0f7',
                      borderRadius: 1,
                    }}
                  >
                    {tt('Rapporter', 'Reports')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={addCohort}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 1,
                      color: '#0f0f0f',
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                      boxShadow: '0 10px 24px rgba(248,179,33,0.26)',
                    }}
                  >
                    {tt('Legg til kohort', 'Add Cohort')}
                  </Button>
                </Stack>
              </Stack>

              {!!saveMessage && (
                <Typography
                  sx={{
                    px: 1.2,
                    py: 0.85,
                    borderRadius: 1,
                    border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.34)',
                    color: '#f8d56f',
                    bgcolor: 'rgba(248,179,33,0.08)',
                  }}
                >
                  {saveMessage}
                </Typography>
              )}

              {(isHydratingCohorts || isPersistingCohorts) && (
                <Typography
                  sx={{
                    px: 1.2,
                    py: 0.7,
                    borderRadius: 1,
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                    color: 'rgba(237,240,247,0.78)',
                    bgcolor: 'rgba(255,255,255,0.04)',
                  }}
                >
                  {isHydratingCohorts
                    ? tt('Laster kohortdata fra database ...', 'Loading cohort data from database ...')
                    : tt('Lagrer kohortutkast ...', 'Saving cohort draft ...')}
                </Typography>
              )}

              <Box sx={{ ...panelSx, p: 1.2 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  sx={{ mb: 1 }}
                >
                  <Stack direction="row" spacing={1}>
                    <Select
                      size="small"
                      value={selectedCourseValue}
                      displayEmpty
                      onChange={(event) => {
                        const nextCourseId = String(event.target.value);
                        setSelectedCourseId(nextCourseId);
                        syncCourseIdInRoute(nextCourseId);
                      }}
                      sx={{
                        minWidth: 210,
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                      }}
                    >
                      {courseItems.length === 0 && (
                        <MenuItem value="" disabled>
                          {tt('Ingen kompetanser', 'No competencies')}
                        </MenuItem>
                      )}
                      {courseItems.map((course) => (
                        <MenuItem key={course.id} value={course.id}>
                          {course.title}
                        </MenuItem>
                      ))}
                    </Select>
                    <Select
                      size="small"
                      value={filter}
                      onChange={(event) => setFilter(event.target.value as CohortFilter)}
                      sx={{
                        minWidth: 160,
                        color: '#edf0f7',
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                      }}
                    >
                      <MenuItem value="all">{tt('Alle kohorter', 'All Cohorts')}</MenuItem>
                      <MenuItem value="active">{tt('Aktiv', 'Active')}</MenuItem>
                      <MenuItem value="early_access">{tt('Tidlig tilgang', 'Early Access')}</MenuItem>
                      <MenuItem value="invitation_only">{tt('Kun invitasjon', 'Invitation Only')}</MenuItem>
                      <MenuItem value="closed">{tt('Lukket', 'Closed')}</MenuItem>
                    </Select>
                  </Stack>
                </Stack>

                <TextField
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={tt('Søk kohorter...', 'Search cohorts...')}
                  size="small"
                  InputProps={{
                    startAdornment: <Search fontSize="small" sx={{ mr: 0.7, color: 'rgba(237,240,247,0.6)' }} />,
                  }}
                  sx={{
                    width: '100%',
                    '& .MuiInputBase-root': {
                      bgcolor: 'rgba(11,14,22,0.8)',
                      color: '#edf0f7',
                    },
                  }}
                />

                <Stack direction="row" spacing={2} sx={{ mt: 1.1, color: 'rgba(237,240,247,0.7)' }}>
                  <Typography>{visibleCohorts.length} {tt('kohorter', 'Cohorts')}</Typography>
                  <Typography>{tt('Side 1 av', 'Page 1 of')} {Math.max(1, Math.ceil(visibleCohorts.length / 5))}</Typography>
                </Stack>

                <Box
                  sx={{
                    mt: 1.1,
                    borderRadius: 1,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.09)',
                  }}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(220px, 1.4fr) 1fr 0.8fr 0.8fr 0.5fr',
                      minWidth: 920,
                      px: 1,
                      py: 0.8,
                      background: 'rgba(255,255,255,0.04)',
                      borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>{tt('Kohortnavn', 'Cohort Name')}</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>{tt('Start og slutt', 'Start & End')}</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>{tt('Påmeldinger', 'Enrollments')}</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)' }}>{tt('Fullføringsrate', 'Completion Rate')}</Typography>
                    <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.7)', textAlign: 'right' }}>{tt('Handlinger', 'Actions')}</Typography>
                  </Box>

                  <Stack spacing={0}>
                    {visibleCohorts.map((cohort) => {
                      const isSelected = selectedCohort?.id === cohort.id;
                      const fill = Math.round((cohort.enrollments / Math.max(cohort.capacity, 1)) * 100);

                      return (
                        <Box
                          key={cohort.id}
                          onClick={() => setSelectedCohortId(cohort.id)}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(220px, 1.4fr) 1fr 0.8fr 0.8fr 0.5fr',
                            minWidth: 920,
                            gap: 0.8,
                            px: 1,
                            py: 1,
                            cursor: 'pointer',
                            background: isSelected
                              ? 'linear-gradient(90deg, rgba(248,179,33,0.12), rgba(255,255,255,0.02))'
                              : 'rgba(8,11,18,0.6)',
                            borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                            '&:hover': {
                              background: 'linear-gradient(90deg, rgba(248,179,33,0.12), rgba(255,255,255,0.02))',
                            },
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
                            <Box
                              sx={{
                                width: 84,
                                height: 50,
                                borderRadius: 1,
                                border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                                background: placeholderBackgrounds[cohort.imageTheme % placeholderBackgrounds.length],
                                flexShrink: 0,
                              }}
                            />
                            <Box minWidth={0}>
                              <Typography sx={{ fontWeight: 600 }} noWrap>
                                {cohort.name}
                              </Typography>
                              <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.66)' }} noWrap>
                                {cohort.subtitle}
                              </Typography>
                            </Box>
                          </Stack>

                          <Typography sx={{ color: 'rgba(237,240,247,0.76)', fontSize: 13 }}>
                            {formatDateRange(cohort.startDate, cohort.endDate, dateLocale)}
                          </Typography>

                          <Box>
                            <Typography sx={{ fontWeight: 600 }}>
                              {cohort.enrollments}/{cohort.capacity}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={fill}
                              sx={{
                                mt: 0.4,
                                height: 5,
                                borderRadius: 999,
                                bgcolor: 'rgba(255,255,255,0.14)',
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 999,
                                  background: 'linear-gradient(90deg, #7fb4ff 0%, #f8b321 100%)',
                                },
                              }}
                            />
                          </Box>

                          <Box>
                            <Typography sx={{ color: '#f8d56f', fontWeight: 700 }}>▲ {cohort.completionRate}%</Typography>
                            <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.66)' }}>
                              {toNok(cohort.revenue)}
                            </Typography>
                          </Box>

                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                openCohortEnrollment(cohort);
                              }}
                              sx={{ color: 'rgba(237,240,247,0.68)' }}
                            >
                              <MailOutline fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedCohortId(cohort.id);
                              }}
                              sx={{ color: 'rgba(237,240,247,0.68)' }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeSelectedCohort(cohort.id);
                              }}
                              sx={{ color: 'rgba(237,240,247,0.68)' }}
                            >
                              <MoreHoriz fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  sx={{ mt: 1.1 }}
                >
                  <TextField
                    placeholder={tt('Søk leksjoner...', 'Search lessons...')}
                    size="small"
                    InputProps={{
                      startAdornment: <Search fontSize="small" sx={{ mr: 0.7, color: 'rgba(237,240,247,0.6)' }} />,
                    }}
                    sx={{
                      flex: 1,
                      '& .MuiInputBase-root': {
                        bgcolor: 'rgba(11,14,22,0.8)',
                        color: '#edf0f7',
                      },
                    }}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button sx={{ textTransform: 'none', color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}>{tt('Side 1 av 14', 'Page 1 of 14')}</Button>
                    <Button sx={{ minWidth: 36, color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}>{'<'}</Button>
                    <Button sx={{ minWidth: 36, color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}>{'>'}</Button>
                  </Stack>
                </Stack>

                <Typography sx={{ mt: 1.3, fontSize: 26, fontWeight: 600 }}>{tt('Kommende kohorter', 'Upcoming Cohorts')}</Typography>

                <Box
                  sx={{
                    mt: 1,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1,
                  }}
                >
                  {upcomingCohorts.map((cohort, index) => (
                    <Box
                      key={`upcoming-${cohort.id}`}
                      sx={{
                        ...panelSx,
                        p: 1,
                        minHeight: 184,
                        borderColor: 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <Box
                        sx={{
                          height: 90,
                          borderRadius: 1,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                          background: placeholderBackgrounds[(index + 1) % placeholderBackgrounds.length],
                        }}
                      />
                      <Typography sx={{ mt: 0.8, fontSize: 17, fontWeight: 600, minHeight: 48 }}>
                        {cohort.name}
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: 'rgba(237,240,247,0.64)' }}>
                        {formatDateRange(cohort.startDate, cohort.endDate, dateLocale)}
                      </Typography>
                      <Stack direction="row" spacing={0.8} sx={{ mt: 0.8 }}>
                        <Button
                          size="small"
                          onClick={() => setSelectedCohortId(cohort.id)}
                          sx={{ textTransform: 'none', color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}
                        >
                          {tt('Administrer', 'Manage')}
                        </Button>
                        <Button
                          size="small"
                          onClick={() => openCohortEnrollment(cohort)}
                          sx={{ textTransform: 'none', color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}
                        >
                          {tt('Vis', 'View')}
                        </Button>
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>

            <Box sx={{ ...panelSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 1.2, borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)' }}>
                <Typography sx={{ fontSize: 28, fontWeight: 600 }}>{tt('Kohortadministrasjon', 'Cohort Management')}</Typography>
                <Stack direction="row" spacing={0.8} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  <Chip
                    label={tt('Tidlig tilgang', 'Early Access')}
                    onClick={() => toggleFeatureFlag('earlyAccess')}
                    color={featureFlags.earlyAccess ? 'warning' : 'default'}
                    sx={{ color: '#edf0f7' }}
                  />
                  <Chip
                    label={tt('Kun invitasjon', 'Invitation Only')}
                    onClick={() => toggleFeatureFlag('invitationOnly')}
                    color={featureFlags.invitationOnly ? 'warning' : 'default'}
                    sx={{ color: '#edf0f7' }}
                  />
                  <Chip
                    label={tt('Lukket', 'Closed')}
                    onClick={() => toggleFeatureFlag('closed')}
                    color={featureFlags.closed ? 'warning' : 'default'}
                    sx={{ color: '#edf0f7' }}
                  />
                  <Chip
                    label={tt('Dryppslipp', 'Drip Release')}
                    onClick={() => toggleFeatureFlag('dripRelease')}
                    color={featureFlags.dripRelease ? 'warning' : 'default'}
                    sx={{ color: '#edf0f7' }}
                  />
                </Stack>
              </Box>

              <Box sx={{ p: 1.2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ ...panelSx, p: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: 18, fontWeight: 700 }}>
                      {tt('Valgt kohort', 'Selected Cohort')}
                    </Typography>
                    {selectedCohort && (
                      <Button
                        size="small"
                        onClick={() => removeSelectedCohort(selectedCohort.id)}
                        sx={{
                          textTransform: 'none',
                          color: '#edf0f7',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                        }}
                      >
                        {tt('Fjern', 'Remove')}
                      </Button>
                    )}
                  </Stack>

                  {!selectedCohort ? (
                    <Typography sx={{ mt: 1, color: 'rgba(237,240,247,0.64)' }}>
                      {tt('Ingen kohort valgt.', 'No cohort selected.')}
                    </Typography>
                  ) : (
                    <Stack spacing={0.8} sx={{ mt: 1 }}>
                      <TextField
                        label={tt('Kohortnavn', 'Cohort name')}
                        value={selectedCohort.name}
                        onChange={(event) => updateSelectedCohort({ name: event.target.value })}
                        size="small"
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' } }}
                      />
                      <TextField
                        label={tt('Beskrivelse', 'Description')}
                        value={selectedCohort.subtitle}
                        onChange={(event) => updateSelectedCohort({ subtitle: event.target.value })}
                        size="small"
                        sx={{ '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' } }}
                      />
                      <Stack direction="row" spacing={0.8}>
                        <TextField
                          label={tt('Startdato', 'Start date')}
                          type="date"
                          value={selectedCohort.startDate}
                          onChange={(event) => updateSelectedCohort({ startDate: event.target.value })}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' } }}
                        />
                        <TextField
                          label={tt('Sluttdato', 'End date')}
                          type="date"
                          value={selectedCohort.endDate}
                          onChange={(event) => updateSelectedCohort({ endDate: event.target.value })}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' } }}
                        />
                      </Stack>
                      <Stack direction="row" spacing={0.8}>
                        <TextField
                          label={tt('Påmeldinger', 'Enrollments')}
                          type="number"
                          value={selectedCohort.enrollments}
                          onChange={(event) =>
                            updateSelectedCohort({ enrollments: Math.max(0, Number(event.target.value || 0)) })
                          }
                          size="small"
                          sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' } }}
                        />
                        <TextField
                          label={tt('Kapasitet', 'Capacity')}
                          type="number"
                          value={selectedCohort.capacity}
                          onChange={(event) =>
                            updateSelectedCohort({ capacity: Math.max(1, Number(event.target.value || 1)) })
                          }
                          size="small"
                          sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' } }}
                        />
                      </Stack>
                      <Stack direction="row" spacing={0.8}>
                        <TextField
                          label={tt('Fullføringsrate', 'Completion rate')}
                          type="number"
                          value={selectedCohort.completionRate}
                          onChange={(event) =>
                            updateSelectedCohort({
                              completionRate: Math.min(100, Math.max(0, Number(event.target.value || 0))),
                            })
                          }
                          size="small"
                          sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' } }}
                        />
                        <TextField
                          label={tt('Inntekt (NOK)', 'Revenue (NOK)')}
                          type="number"
                          value={selectedCohort.revenue}
                          onChange={(event) =>
                            updateSelectedCohort({ revenue: Math.max(0, Number(event.target.value || 0)) })
                          }
                          size="small"
                          sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' } }}
                        />
                      </Stack>
                      <Select
                        size="small"
                        value={selectedCohort.status}
                        onChange={(event) => updateSelectedCohort({ status: event.target.value as CohortStatus })}
                        sx={{
                          color: '#edf0f7',
                          bgcolor: 'rgba(255,255,255,0.03)',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
                        }}
                      >
                        <MenuItem value="active">{tt('Aktiv', 'Active')}</MenuItem>
                        <MenuItem value="early_access">{tt('Tidlig tilgang', 'Early Access')}</MenuItem>
                        <MenuItem value="invitation_only">{tt('Kun invitasjon', 'Invitation Only')}</MenuItem>
                        <MenuItem value="closed">{tt('Lukket', 'Closed')}</MenuItem>
                      </Select>
                    </Stack>
                  )}
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{tt('Kohorttagger', 'Cohort Tags')}</Typography>

                  <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 0.8 }}>
                    {(selectedCohort?.tags || []).map((tag) => (
                      <Chip
                        key={`selected-tag-${tag}`}
                        label={navLabel(tag)}
                        onDelete={() => removeTagFromSelected(tag)}
                        sx={{
                          color: '#edf0f7',
                          bgcolor: 'rgba(255,255,255,0.08)',
                          '& .MuiChip-deleteIcon': { color: 'rgba(237,240,247,0.7)' },
                        }}
                      />
                    ))}
                  </Stack>

                  <Stack direction="row" spacing={0.8} sx={{ mt: 1 }}>
                    <TextField
                      value={tagDraft}
                      onChange={(event) => setTagDraft(event.target.value)}
                      placeholder={tt('Legg til tagg', 'Add tag')}
                      size="small"
                      sx={{ flex: 1, '& .MuiInputBase-root': { color: '#edf0f7' } }}
                    />
                    <Button
                      onClick={addTagToSelected}
                      sx={{ textTransform: 'none', color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}
                    >
                      {tt('Legg til', 'Add')}
                    </Button>
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 26, fontWeight: 600, mb: 0.8 }}>{tt('Ytelseshøydepunkter', 'Performance Highlights')}</Typography>
                  <Stack direction="row" spacing={1}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#f8d56f' }}>+{enrollmentVelocity}%</Typography>
                      <Typography sx={{ color: 'rgba(237,240,247,0.7)' }}>{tt('Påmeldingshastighet', 'Enrollment Velocity')}</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 24, fontWeight: 700 }}>{averageCompletion}%</Typography>
                      <Typography sx={{ color: 'rgba(237,240,247,0.7)' }}>{tt('Gj.sn. fullføring', 'Avg Completion')}</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 24, fontWeight: 700 }}>{toNok(totalRevenue)}</Typography>
                      <Typography sx={{ color: 'rgba(237,240,247,0.7)' }}>{tt('Inntekt', 'Revenue')}</Typography>
                    </Box>
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 26, fontWeight: 600, mb: 0.8 }}>{tt('Kohort-toppliste', 'Cohort Leaderboard')}</Typography>
                  <Stack spacing={0.8}>
                    {leaderboard.map((cohort) => (
                      <Stack
                        key={`leader-${cohort.id}`}
                        direction="row"
                        spacing={0.8}
                        alignItems="center"
                        sx={{
                          px: 0.8,
                          py: 0.8,
                          borderRadius: 1,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                          bgcolor: 'rgba(10,14,22,0.7)',
                        }}
                      >
                        <Box
                          sx={{
                            width: 46,
                            height: 46,
                            borderRadius: 1,
                            border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                            background: placeholderBackgrounds[cohort.imageTheme % placeholderBackgrounds.length],
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap sx={{ fontWeight: 600 }}>{cohort.name}</Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.64)' }} noWrap>
                            {formatDateRange(cohort.startDate, cohort.endDate, dateLocale)}
                          </Typography>
                        </Box>
                        <Typography sx={{ color: '#f8d56f', fontWeight: 700 }}>{cohort.completionRate}%</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: 26, fontWeight: 600 }}>{tt('Ny diskusjon', 'New Discussion')}</Typography>
                    <Button
                      size="small"
                      onClick={addDiscussion}
                      sx={{ textTransform: 'none', color: '#edf0f7', border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)' }}
                    >
                      {tt('Legg til', 'Add')}
                    </Button>
                  </Stack>

                  <Stack direction="row" spacing={0.8} sx={{ mt: 0.8 }}>
                    <TextField
                      value={discussionAuthor}
                      onChange={(event) => setDiscussionAuthor(event.target.value)}
                      size="small"
                      label={tt('Forfatter', 'Author')}
                      sx={{
                        width: 130,
                        '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' },
                      }}
                    />
                    <TextField
                      value={discussionDraft}
                      onChange={(event) => setDiscussionDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          addDiscussion();
                        }
                      }}
                      size="small"
                      label={tt('Diskusjonsnotat', 'Discussion Note')}
                      placeholder={tt('Skriv notat for kohortdiskusjon', 'Write cohort discussion note')}
                      sx={{
                        flex: 1,
                        '& .MuiInputBase-root': { color: '#edf0f7', bgcolor: 'rgba(255,255,255,0.03)' },
                      }}
                    />
                    <Button
                      size="small"
                      onClick={addDiscussion}
                      sx={{
                        textTransform: 'none',
                        color: '#edf0f7',
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
                        minWidth: 70,
                      }}
                    >
                      Post
                    </Button>
                  </Stack>

                  <Stack spacing={0.8} sx={{ mt: 0.8 }}>
                    {discussionItems.map((item, index) => (
                      <Stack
                        key={item.id}
                        direction="row"
                        spacing={0.8}
                        alignItems="flex-start"
                        sx={{
                          px: 0.8,
                          py: 0.8,
                          borderRadius: 1,
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)',
                          bgcolor: index === 0 ? 'rgba(248,179,33,0.08)' : 'rgba(10,14,22,0.7)',
                        }}
                      >
                        <Avatar sx={{ width: 30, height: 30, bgcolor: 'rgba(248,179,33,0.78)', color: '#111' }}>
                          {item.author.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700 }}>{item.author}</Typography>
                          <Typography sx={{ color: 'rgba(237,240,247,0.72)' }}>{item.message}</Typography>
                          <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.58)' }}>{item.timestamp}</Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

              <Stack direction="row" spacing={1} sx={{ p: 1.1 }}>
                <Button
                  startIcon={<Campaign />}
                  onClick={() => setLocation('/academy/cta-overlay')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                  }}
                >
                  {tt('CTA', 'CTA')}
                </Button>
                <Button
                  startIcon={<Subtitles />}
                  onClick={() => setLocation('/academy/lower-thirds')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                  }}
                >
                  {tt('Supring Studio', 'Lower Thirds Studio')}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  startIcon={<Lock />}
                  onClick={() => toggleFeatureFlag('closed')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {featureFlags.closed ? tt('Sikret', 'Secured') : tt('Sikre', 'Secure')}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  startIcon={<Save />}
                  onClick={() => void saveCohortSettings(false)}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Lagre', 'Save')}
                </Button>
                <Button
                  startIcon={<Publish />}
                  onClick={() => void saveCohortSettings(true)}
                  sx={{
                    minWidth: 118,
                    textTransform: 'none',
                    color: '#0f0f0f',
                    background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                    fontWeight: 700,
                  }}
                >
                  {tt('Publiser', 'Publish')}
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
                    color: 'rgba(237,240,247,0.78)',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Lukk', 'Close')}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  startIcon={<MonetizationOn />}
                  onClick={() => setLocation('/academy/monetization')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Monetisering', 'Monetization')}
                </Button>
                <Button
                  startIcon={<TrendingUp />}
                  onClick={() => setLocation('/academy/analytics')}
                  sx={{
                    flex: 1,
                    textTransform: 'none',
                    color: '#edf0f7',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                  }}
                >
                  {tt('Analyser', 'Analytics')}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 12 }}>
                  {tt('Status', 'Status')}: {localizedStatusLabel(selectedCohort?.status || 'active')} · {selectedCohort?.enrollments || 0} {tt('påmeldt', 'enrolled')}
                </Typography>
                <Box sx={{ ml: 'auto' }}>
                  <Switch
                    checked={featureFlags.dripRelease}
                    onChange={() => toggleFeatureFlag('dripRelease')}
                    size="small"
                  />
                </Box>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyCohortSettingsStudio, {
  componentId: 'academy-cohort-settings-studio',
  componentName: 'Academy Cohort Settings Studio',
  componentType: 'manager',
  componentCategory: 'academy',
  featureIds: ['cohort-settings', 'cohort-management', 'cohort-analytics', 'academy-live-cohorts'],
});
