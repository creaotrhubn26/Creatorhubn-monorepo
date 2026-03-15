import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import {
  Add,
  Assessment,
  Download,
  MailOutline,
  MonetizationOn,
  MoreHoriz,
  NotificationsNone,
  PeopleAlt,
  ShowChart,
  TrendingUp,
} from "@mui/icons-material";
import { useLocation } from "wouter";
import { useAcademy, type Enrollment } from "@/contexts/AcademyContext";
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { withUniversalIntegration } from "@/integration/UniversalIntegrationHOC";
import { academyPdfExportService } from "@/services/academyPdfExportService";
import { useAcademyLocale } from "./academyLocale";
import AcademyLocaleSwitcher from "./AcademyLocaleSwitcher";
import AcademyLeftSidebar from "./AcademyLeftSidebar";

interface AcademyAnalyticsStudioProps {
  courseId?: string;
}

type RangeFilter = "7d" | "30d" | "90d";

interface TopCourseRow {
  id: string;
  title: string;
  revenue: number;
  growth: number;
  imageTheme: number;
}

interface TopStudentRow {
  id: string;
  name: string;
  role: string;
  growth: number;
  progress: number;
  avatarTheme: number;
}

interface SourceRow {
  id: string;
  label: string;
  secondaryLabel: string;
  count: number;
  changePct: number;
}

const panelSx = {
  borderRadius: 1.4,
  border: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
  background:
    "linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))",
};

const placeholderBackgrounds = [
  "linear-gradient(145deg, rgba(24,30,42,0.92), rgba(12,16,24,0.98)), radial-gradient(circle at 85% 16%, rgba(245,166,35,0.34), rgba(0,0,0,0))",
  "linear-gradient(145deg, rgba(18,23,34,0.95), rgba(10,14,21,0.98)), radial-gradient(circle at 12% 82%, rgba(245,166,35,0.24), rgba(0,0,0,0))",
  "linear-gradient(145deg, rgba(17,21,31,0.94), rgba(8,12,18,0.98)), radial-gradient(circle at 72% 10%, rgba(114,158,225,0.2), rgba(0,0,0,0))",
  "linear-gradient(145deg, rgba(19,24,36,0.93), rgba(11,14,22,0.98)), radial-gradient(circle at 70% 22%, rgba(248,179,33,0.22), rgba(0,0,0,0))",
];

const defaultTopStudents: TopStudentRow[] = [
  {
    id: "s1",
    name: "Sarah Johnson",
    role: "Filmmaker",
    growth: 9.5,
    progress: 58,
    avatarTheme: 0,
  },
  {
    id: "s2",
    name: "Adrian Berglund",
    role: "Cinematographer",
    growth: 30,
    progress: 66,
    avatarTheme: 1,
  },
  {
    id: "s3",
    name: "Lisa Holden",
    role: "Drone Pilot",
    growth: 32,
    progress: 41,
    avatarTheme: 2,
  },
];

const formatNok = (value: number): string =>
  new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

const formatInteger = (value: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.max(0, value),
  );

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const progressFromEnrollment = (enrollment: Enrollment): number => {
  const progressRows = Array.isArray(enrollment?.progress)
    ? enrollment.progress
    : [];
  if (progressRows.length === 0) return 0;
  const total = progressRows.reduce(
    (sum, row) => sum + Number(row?.progress || 0),
    0,
  );
  return Math.round(total / progressRows.length);
};

const studentNameFromId = (studentId: string, index: number): string => {
  const source = String(studentId || "").trim();
  if (!source) return `Student ${index + 1}`;
  const normalized = source.includes("@") ? source.split("@")[0] : source;
  const tokens = normalized
    .replace(/[._]+/g, "-")
    .split("-")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (tokens.length === 0) return `Student ${index + 1}`;
  return tokens
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
};

const buildSeries = (
  start: number,
  end: number,
  points: number,
  jitter = 0.08,
): number[] => {
  if (points <= 1) return [Math.round(start)];
  const range = end - start;
  return Array.from({ length: points }, (_, index) => {
    const t = index / (points - 1);
    const base = start + range * t;
    const wave = Math.sin(index * 0.9) * range * jitter;
    return Math.round(base + wave);
  });
};

const pathFromSeries = (
  values: number[],
  width: number,
  height: number,
  pad = 12,
): string => {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  return values
    .map((value, index) => {
      const x =
        pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2);
      const y = height - pad - ((value - min) / range) * (height - pad * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

function AcademyAnalyticsStudio({ courseId }: AcademyAnalyticsStudioProps) {
  const [location, setLocation] = useLocation();
  const { state, getCourse, setCurrentCourse } = useAcademy();
  const { analytics } = useEnhancedMasterIntegration();

  const { navLabel, tt, language } = useAcademyLocale();

  const [leftNav, setLeftNav] = useState("analytics");
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || "all");
  const [range, setRange] = useState<RangeFilter>("30d");
  const [growthMode, setGrowthMode] = useState<"daily" | "weekly">("daily");
  const [revenueRange, setRevenueRange] = useState<RangeFilter>("30d");

  const courses = useMemo(() => {
    if (Array.isArray(state?.courses) && state.courses.length > 0)
      return state.courses;
    return [];
  }, [state?.courses]);

  const enrollments = useMemo(
    () => (Array.isArray(state?.enrollments) ? state.enrollments : []),
    [state?.enrollments],
  );

  const filteredCourses = useMemo(() => {
    if (selectedCourseId === "all") return courses;
    return courses.filter(
      (course) => String(course.id) === String(selectedCourseId),
    );
  }, [courses, selectedCourseId]);

  const activeCourse = useMemo(() => {
    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;
    if (selectedCourseId !== "all") {
      const fromSelected = filteredCourses[0];
      if (fromSelected) return fromSelected;
    }
    return state.currentCourse || courses[0] || null;
  }, [
    courseId,
    courses,
    filteredCourses,
    getCourse,
    selectedCourseId,
    state.currentCourse,
  ]);

  const syncCourseIdInRoute = useCallback(
    (nextCourseId: string) => {
      const normalizedCourseId = String(nextCourseId || "").trim();
      const [pathname, rawQuery = ""] = location.split("?");
      const params = new URLSearchParams(rawQuery);

      if (normalizedCourseId && normalizedCourseId !== "all") {
        params.set("courseId", normalizedCourseId);
      } else {
        params.delete("courseId");
      }
      params.delete("course_id");

      const suffix = params.toString();
      setLocation(suffix ? `${pathname}?${suffix}` : pathname);
    },
    [location, setLocation],
  );

  useEffect(() => {
    const nextCourseId = String(courseId || "").trim();
    if (!nextCourseId) return;
    setSelectedCourseId((previousCourseId) =>
      previousCourseId === nextCourseId ? previousCourseId : nextCourseId,
    );
  }, [courseId]);

  useEffect(() => {
    if (!activeCourse?.id) return;
    const inState = state.courses.some(
      (course) => String(course.id) === String(activeCourse.id),
    );
    if (!inState) return;
    if (String(state.currentCourse?.id || "") === String(activeCourse.id))
      return;
    setCurrentCourse(activeCourse);
  }, [activeCourse, setCurrentCourse, state.courses, state.currentCourse?.id]);

  const filteredEnrollments = useMemo(() => {
    if (selectedCourseId === "all") return enrollments;
    return enrollments.filter(
      (enrollment) => String(enrollment.courseId) === String(selectedCourseId),
    );
  }, [enrollments, selectedCourseId]);

  const enrolledCount = useMemo(() => {
    if (filteredEnrollments.length > 0) return filteredEnrollments.length;
    const fromStudents = filteredCourses.reduce(
      (sum, course) => sum + Number(course.studentCount || 0),
      0,
    );
    return Math.max(1250, fromStudents || 0);
  }, [filteredCourses, filteredEnrollments.length]);

  const activeStudents = useMemo(() => {
    if (filteredEnrollments.length > 0) {
      const unique = new Set(
        filteredEnrollments.map((row) => String(row.studentId || "guest")),
      );
      return unique.size;
    }
    return Math.max(890, Math.round(enrolledCount * 0.71));
  }, [enrolledCount, filteredEnrollments]);

  const engagementRate = useMemo(() => {
    if (filteredEnrollments.length > 0) {
      const values = filteredEnrollments.map((row) =>
        progressFromEnrollment(row),
      );
      return clamp(
        Math.round(
          values.reduce((sum, value) => sum + value, 0) /
            Math.max(values.length, 1),
        ),
        0,
        100,
      );
    }
    return 78;
  }, [filteredEnrollments]);

  const revenueTotal = useMemo(() => {
    const fallback = Math.max(
      92450,
      filteredCourses.reduce(
        (sum, course) =>
          sum +
          Number(course.price || 0) *
            Math.max(1, Number(course.studentCount || 1)) *
            0.21,
        0,
      ),
    );
    if (filteredEnrollments.length === 0) return Math.round(fallback);

    const byCourse = filteredCourses.reduce((sum, course) => {
      const count = filteredEnrollments.filter(
        (row) => String(row.courseId) === String(course.id),
      ).length;
      return sum + Number(course.price || 0) * Math.max(1, count);
    }, 0);
    return Math.max(1000, Math.round(byCourse));
  }, [filteredCourses, filteredEnrollments]);

  const revenueBreakdown = useMemo(() => {
    const courseSales = Math.round(revenueTotal * 0.65);
    const subscriptions = Math.round(revenueTotal * 0.25);
    const affiliates = Math.max(0, revenueTotal - courseSales - subscriptions);
    return [
      {
        id: "sales",
        label: "Course Sales",
        value: courseSales,
        color: "#f8b321",
      },
      {
        id: "subscriptions",
        label: "Subscriptions",
        value: subscriptions,
        color: "#8ea6d6",
      },
      {
        id: "affiliates",
        label: "Affiliates",
        value: affiliates,
        color: "#f5d47a",
      },
    ];
  }, [revenueTotal]);

  const topCourses = useMemo<TopCourseRow[]>(() => {
    const rows = filteredCourses.map((course, index) => {
      const enrollmentCountForCourse = filteredEnrollments.filter(
        (entry) => String(entry.courseId) === String(course.id),
      ).length;
      const fallbackEnrollments = Number(course.studentCount || 0);
      const effectiveEnrollments = Math.max(
        enrollmentCountForCourse,
        fallbackEnrollments,
        1,
      );
      const revenue = Math.round(
        effectiveEnrollments * Number(course.price || 0),
      );
      const growth = 8 + (index + 1) * 7;
      return {
        id: String(course.id),
        title: String(course.title || "Untitled Course"),
        revenue,
        growth,
        imageTheme: index % placeholderBackgrounds.length,
      };
    });

    return rows.sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  }, [filteredCourses, filteredEnrollments]);

  const topStudents = useMemo<TopStudentRow[]>(() => {
    if (filteredEnrollments.length === 0) return defaultTopStudents;

    const grouped = new Map<
      string,
      { progress: number[]; courses: Set<string> }
    >();
    filteredEnrollments.forEach((entry) => {
      const key = String(entry.studentId || "guest");
      const bucket = grouped.get(key) || {
        progress: [],
        courses: new Set<string>(),
      };
      bucket.progress.push(progressFromEnrollment(entry));
      bucket.courses.add(String(entry.courseId || ""));
      grouped.set(key, bucket);
    });

    return Array.from(grouped.entries())
      .map(([studentId, values], index) => {
        const progress = Math.round(
          values.progress.reduce((sum, value) => sum + value, 0) /
            Math.max(values.progress.length, 1),
        );
        return {
          id: `student-${studentId}`,
          name: studentNameFromId(studentId, index),
          role: `${values.courses.size} courses`,
          growth: 6 + values.courses.size * 8,
          progress,
          avatarTheme: index % placeholderBackgrounds.length,
        };
      })
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3);
  }, [filteredEnrollments]);

  const sourceRows = useMemo<SourceRow[]>(() => {
    const base = [
      {
        id: "src-1",
        label: "Instagram Ad",
        secondaryLabel: "Community Email",
        weight: 0.34,
        change: 11.6,
      },
      {
        id: "src-2",
        label: "YouTube Video",
        secondaryLabel: "YouTube Video",
        weight: 0.31,
        change: 9.4,
      },
      {
        id: "src-3",
        label: "Creator Referral",
        secondaryLabel: "Podcast Episode",
        weight: 0.22,
        change: 8.2,
      },
    ];

    return base.map((entry) => ({
      id: entry.id,
      label: entry.label,
      secondaryLabel: entry.secondaryLabel,
      count: Math.round(enrolledCount * entry.weight),
      changePct: entry.change,
    }));
  }, [enrolledCount]);

  const growthPoints = useMemo(() => {
    const points = growthMode === "daily" ? 10 : 8;
    const enrollSeries = buildSeries(
      Math.round(enrolledCount * 0.28),
      enrolledCount,
      points,
      0.12,
    );
    const activeSeries = buildSeries(
      Math.round(activeStudents * 0.34),
      activeStudents,
      points,
      0.1,
    );
    return { enrollSeries, activeSeries };
  }, [activeStudents, enrolledCount, growthMode]);

  const engagementPoints = useMemo(() => {
    const completionSeries = buildSeries(
      Math.max(35, engagementRate - 22),
      engagementRate,
      8,
      0.06,
    );
    const watchTimeSeries = buildSeries(
      Math.max(30, engagementRate - 26),
      Math.max(50, engagementRate - 2),
      8,
      0.08,
    );
    return { completionSeries, watchTimeSeries };
  }, [engagementRate]);

  const growthEnrollPath = useMemo(
    () => pathFromSeries(growthPoints.enrollSeries, 680, 260),
    [growthPoints.enrollSeries],
  );
  const growthActivePath = useMemo(
    () => pathFromSeries(growthPoints.activeSeries, 680, 260),
    [growthPoints.activeSeries],
  );
  const engagementCompletionPath = useMemo(
    () => pathFromSeries(engagementPoints.completionSeries, 680, 220),
    [engagementPoints.completionSeries],
  );
  const engagementWatchPath = useMemo(
    () => pathFromSeries(engagementPoints.watchTimeSeries, 680, 220),
    [engagementPoints.watchTimeSeries],
  );

  const revenueConic = useMemo(() => {
    const total = Math.max(
      1,
      revenueBreakdown.reduce((sum, row) => sum + row.value, 0),
    );
    let cursor = 0;

    const segments = revenueBreakdown.map((row) => {
      const deg = (row.value / total) * 360;
      const start = cursor;
      cursor += deg;
      return `${row.color} ${start.toFixed(1)}deg ${cursor.toFixed(1)}deg`;
    });

    if (cursor < 360) {
      segments.push(`rgba(255,255,255,0.08) ${cursor.toFixed(1)}deg 360deg`);
    }

    return `conic-gradient(${segments.join(", ")})`;
  }, [revenueBreakdown]);

  useEffect(() => {
    analytics.trackEvent("academy_analytics_studio_opened", {
      courseId: activeCourse?.id || null,
      selectedCourseId,
      range,
      enrollmentCount: enrolledCount,
      activeStudents,
      revenueTotal,
      engagementRate,
      timestamp: Date.now(),
    });
  }, [
    activeCourse?.id,
    activeStudents,
    analytics,
    engagementRate,
    enrolledCount,
    range,
    revenueTotal,
    selectedCourseId,
  ]);

  const handleExport = useCallback(async () => {
    const rangeLabel =
      range === "7d"
        ? tt("Siste 7 dager", "Last 7 days")
        : range === "30d"
          ? tt("Siste 30 dager", "Last 30 days")
          : tt("Siste 90 dager", "Last 90 days");
    const courseLabel =
      selectedCourseId === "all"
        ? tt("Alle kompetanser", "All competencies")
        : String(activeCourse?.title || selectedCourseId);

    analytics.trackEvent("academy_analytics_export_clicked", {
      courseId: selectedCourseId,
      range,
      timestamp: Date.now(),
    });

    await academyPdfExportService.exportReport({
      fileName: `academy-analytics-${selectedCourseId}-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: tt("Analysepanel", "Analytics Dashboard"),
      subtitle: `${courseLabel} · ${rangeLabel}`,
      courseLabel,
      locale: language === "no" ? "nb-NO" : "en-US",
      sections: [
        {
          title: tt("Oversikt", "Overview"),
          subtitle: tt("Nøkkelindikatorer", "Key Indicators"),
          metrics: [
            {
              label: tt("Påmeldte", "Enrolled"),
              value: formatInteger(enrolledCount),
            },
            {
              label: tt("Aktive studenter", "Active Students"),
              value: formatInteger(activeStudents),
            },
            {
              label: tt("Engasjement", "Engagement"),
              value: `${engagementRate}%`,
            },
            {
              label: tt("Inntekt", "Revenue"),
              value: formatNok(revenueTotal),
            },
          ],
        },
        {
          title: tt("Inntektsfordeling", "Revenue Breakdown"),
          table: {
            columns: [
              tt("Kategori", "Category"),
              tt("Beløp", "Amount"),
              tt("Andel", "Share"),
            ],
            rows: revenueBreakdown.map((row) => [
              row.label,
              formatNok(row.value),
              `${Math.round(
                (row.value /
                  Math.max(
                    revenueBreakdown.reduce(
                      (sum, item) => sum + item.value,
                      0,
                    ),
                    1,
                  )) *
                  100,
              )}%`,
            ]),
          },
        },
        {
          title: tt("Toppkompetanser", "Top Competencies"),
          table: {
            columns: [
              tt("Kompetanse", "Competency"),
              tt("Inntekt", "Revenue"),
              tt("Vekst", "Growth"),
            ],
            rows: topCourses.map((course) => [
              course.title,
              formatNok(course.revenue),
              `+${course.growth}%`,
            ]),
          },
        },
        {
          title: tt("Topplærere", "Top Learners"),
          table: {
            columns: [
              tt("Navn", "Name"),
              tt("Fokus", "Focus"),
              tt("Fremdrift", "Progress"),
              tt("Vekst", "Growth"),
            ],
            rows: topStudents.map((student) => [
              student.name,
              student.role,
              `${student.progress}%`,
              `+${student.growth}%`,
            ]),
          },
        },
        {
          title: tt("Kildesporing", "Acquisition Sources"),
          table: {
            columns: [
              tt("Kilde", "Source"),
              tt("Sekundær", "Secondary"),
              tt("Volum", "Volume"),
              tt("Endring", "Change"),
            ],
            rows: sourceRows.map((row) => [
              row.label,
              row.secondaryLabel,
              formatInteger(row.count),
              `+${row.changePct.toFixed(1)}%`,
            ]),
          },
        },
      ],
    });
  }, [
    activeCourse?.title,
    activeStudents,
    analytics,
    engagementRate,
    enrolledCount,
    language,
    range,
    revenueBreakdown,
    revenueTotal,
    selectedCourseId,
    sourceRows,
    topCourses,
    topStudents,
    tt,
  ]);

  const handleReports = useCallback(async () => {
    analytics.trackEvent("academy_analytics_reports_clicked", {
      courseId: selectedCourseId,
      range,
      timestamp: Date.now(),
    });
    await handleExport();
  }, [analytics, handleExport, range, selectedCourseId]);

  const handleCreateChart = useCallback(() => {
    analytics.trackEvent("academy_analytics_create_chart_clicked", {
      courseId: selectedCourseId,
      range,
      timestamp: Date.now(),
    });
  }, [analytics, range, selectedCourseId]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        color: "#edf0f7",
        bgcolor: "#06080d",
        fontFamily: '"Manrope", "Barlow", "Segoe UI", sans-serif',
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 74% 12%, rgba(248,179,33,0.24), rgba(5,8,13,0) 42%), radial-gradient(circle at 16% 74%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 32%)",
        }}
      />

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
          width: "min(100%, var(--academy-shell-max-width, 1920px))",
          mx: "auto",
        }}
      >
        <AcademyLeftSidebar
          activeNav={leftNav}
          onNavigate={(navId, route) => {
            setLeftNav(navId);
            setLocation(route);
          }}
          onCreateCourse={() => {
            setLeftNav("curriculum");
            setLocation("/academy/curriculum?createCompetency=1");
          }}
          tt={tt}
          navLabel={navLabel}
        />

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              height: 74,
              px: 3,
              borderBottom:
                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background:
                "linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))",
            }}
          >
            <Typography
              sx={{
                letterSpacing: "0.22em",
                fontSize: 15,
                color: "rgba(237,240,247,0.82)",
              }}
            >
              CREATOR STUDIO
            </Typography>

            <Stack direction="row" spacing={1.2} alignItems="center">
              <AcademyLocaleSwitcher />
              <IconButton
                size="small"
                onClick={() =>
                  setLocation("/academy/settings?tab=notifications")
                }
                aria-label={tt("Varsler", "Notifications")}
                sx={{ color: "rgba(237,240,247,0.75)" }}
              >
                <NotificationsNone fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocation("/academy/settings?tab=messages")}
                aria-label={tt("Meldinger", "Messages")}
                sx={{ color: "rgba(237,240,247,0.75)" }}
              >
                <MailOutline fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setLocation("/academy/settings?tab=profile")}
                aria-label={tt("Profil", "Profile")}
                sx={{ p: 0 }}
              >
                <Avatar
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: "#f8b321",
                    color: "#111",
                  }}
                >
                  {String(activeCourse?.instructor?.name || "C")
                    .charAt(0)
                    .toUpperCase()}
                </Avatar>
              </IconButton>
            </Stack>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, p: 2, overflow: "auto" }}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", lg: "center" }}
              spacing={1.2}
            >
              <Typography
                sx={{ fontSize: 26, fontWeight: 600, letterSpacing: "0.02em" }}
              >
                {tt("Analysepanel", "Analytics Dashboard")}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={handleExport}
                  sx={{
                    textTransform: "none",
                    borderColor: "rgba(255,255,255,0.2)",
                    color: "#edf0f7",
                  }}
                >
                  {tt("Eksporter", "Export")}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Assessment />}
                  onClick={handleReports}
                  sx={{
                    textTransform: "none",
                    borderColor: "rgba(255,255,255,0.2)",
                    color: "#edf0f7",
                  }}
                >
                  {tt("Rapporter", "Reports")}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleCreateChart}
                  sx={{
                    textTransform: "none",
                    color: "#0f0f0f",
                    background: "linear-gradient(180deg, #ffd44e, #f2a616)",
                    boxShadow: "0 10px 24px rgba(248,179,33,0.25)",
                    fontWeight: 700,
                  }}
                >
                  {tt("Opprett diagram", "Create Chart")}
                </Button>
              </Stack>
            </Stack>

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              sx={{ mt: 1.1 }}
            >
              <Select
                size="small"
                value={selectedCourseId}
                onChange={(event) => {
                  const nextCourseId = String(event.target.value);
                  setSelectedCourseId(nextCourseId);
                  syncCourseIdInRoute(nextCourseId);
                }}
                sx={{
                  minWidth: 190,
                  color: "#edf0f7",
                  bgcolor: "rgba(255,255,255,0.04)",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.16)",
                  },
                }}
              >
                <MenuItem value="all">
                  {tt("Alle kompetanser", "All competencies")}
                </MenuItem>
                {courses.map((course) => (
                  <MenuItem key={course.id} value={course.id}>
                    {course.title}
                  </MenuItem>
                ))}
              </Select>

              <Select
                size="small"
                value={range}
                onChange={(event) =>
                  setRange(event.target.value as RangeFilter)
                }
                sx={{
                  minWidth: 160,
                  color: "#edf0f7",
                  bgcolor: "rgba(255,255,255,0.04)",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.16)",
                  },
                }}
              >
                <MenuItem value="7d">
                  {tt("Siste 7 dager", "Last 7 days")}
                </MenuItem>
                <MenuItem value="30d">
                  {tt("Siste 30 dager", "Last 30 days")}
                </MenuItem>
                <MenuItem value="90d">
                  {tt("Siste 90 dager", "Last 90 days")}
                </MenuItem>
              </Select>
            </Stack>

            <Box
              sx={{
                ...panelSx,
                mt: 1.1,
                p: 1,
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  xl: "repeat(4, minmax(0, 1fr))",
                },
                gap: 1,
              }}
            >
              <Box
                sx={{
                  borderRight: {
                    xl: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                  },
                  pr: { xl: 1 },
                }}
              >
                <Stack direction="row" spacing={0.7} alignItems="center">
                  <PeopleAlt sx={{ color: "#f8d56f" }} />
                  <Typography sx={{ color: "rgba(237,240,247,0.78)" }}>
                    {tt("Studentpåmeldinger", "Student Enrollments")}
                  </Typography>
                </Stack>
                <Typography
                  sx={{ fontSize: 34, lineHeight: 1, fontWeight: 700, mt: 0.4 }}
                >
                  {formatInteger(enrolledCount)}
                </Typography>
                <Typography sx={{ color: "#9acd6f", fontSize: 13, mt: 0.3 }}>
                  {tt("▲ 15.2% mot siste 30 dager", "▲ 15.2% vs last 30 days")}
                </Typography>
              </Box>

              <Box
                sx={{
                  borderRight: {
                    xl: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                  },
                  pr: { xl: 1 },
                }}
              >
                <Stack direction="row" spacing={0.7} alignItems="center">
                  <PeopleAlt sx={{ color: "#f8d56f" }} />
                  <Typography sx={{ color: "rgba(237,240,247,0.78)" }}>
                    {tt("Aktive studenter", "Active Students")}
                  </Typography>
                </Stack>
                <Typography
                  sx={{ fontSize: 34, lineHeight: 1, fontWeight: 700, mt: 0.4 }}
                >
                  {formatInteger(activeStudents)}
                </Typography>
                <Typography sx={{ color: "#9acd6f", fontSize: 13, mt: 0.3 }}>
                  {tt("▲ 17.9% mot siste 30 dager", "▲ 17.9% vs last 30 days")}
                </Typography>
              </Box>

              <Box
                sx={{
                  borderRight: {
                    xl: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                  },
                  pr: { xl: 1 },
                }}
              >
                <Stack direction="row" spacing={0.7} alignItems="center">
                  <MonetizationOn sx={{ color: "#f8d56f" }} />
                  <Typography sx={{ color: "rgba(237,240,247,0.78)" }}>
                    {tt("Total inntekt", "Total Revenue")}
                  </Typography>
                </Stack>
                <Typography
                  sx={{ fontSize: 34, lineHeight: 1, fontWeight: 700, mt: 0.4 }}
                >
                  {formatNok(revenueTotal)}
                </Typography>
                <Typography sx={{ color: "#9acd6f", fontSize: 13, mt: 0.3 }}>
                  {tt("▲ 21.6% mot siste 30 dager", "▲ 21.6% vs last 30 days")}
                </Typography>
              </Box>

              <Box>
                <Stack direction="row" spacing={0.7} alignItems="center">
                  <TrendingUp sx={{ color: "#f8d56f" }} />
                  <Typography sx={{ color: "rgba(237,240,247,0.78)" }}>
                    {tt("Engasjementsrate", "Engagement Rate")}
                  </Typography>
                </Stack>
                <Typography
                  sx={{ fontSize: 34, lineHeight: 1, fontWeight: 700, mt: 0.4 }}
                >
                  {engagementRate}%
                </Typography>
                <Typography sx={{ color: "#9acd6f", fontSize: 13, mt: 0.3 }}>
                  {tt("▲ 4.6% mot siste 30 dager", "▲ 4.6% vs last 30 days")}
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                mt: 1.1,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 520px" },
                gap: 1,
              }}
            >
              <Box sx={{ ...panelSx, p: 1 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 0.8 }}
                >
                  <Typography
                    sx={{ fontSize: 22, lineHeight: 1, fontWeight: 600 }}
                  >
                    {tt("Studentvekst", "Student Growth")}
                  </Typography>
                  <Stack direction="row" spacing={0.8}>
                    <Select
                      size="small"
                      value={growthMode}
                      onChange={(event) =>
                        setGrowthMode(event.target.value as "daily" | "weekly")
                      }
                      sx={{
                        minWidth: 100,
                        color: "#edf0f7",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255,255,255,0.16)",
                        },
                      }}
                    >
                      <MenuItem value="daily">{tt("Daglig", "Daily")}</MenuItem>
                      <MenuItem value="weekly">
                        {tt("Ukentlig", "Weekly")}
                      </MenuItem>
                    </Select>
                    <Select
                      size="small"
                      value={selectedCourseId}
                      onChange={(event) => {
                        const nextCourseId = String(event.target.value);
                        setSelectedCourseId(nextCourseId);
                        syncCourseIdInRoute(nextCourseId);
                      }}
                      sx={{
                        minWidth: 120,
                        color: "#edf0f7",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255,255,255,0.16)",
                        },
                      }}
                    >
                      <MenuItem value="all">
                        {tt("Påmeldte", "Enrollees")}
                      </MenuItem>
                      {courses.map((course) => (
                        <MenuItem key={`growth-${course.id}`} value={course.id}>
                          {course.title}
                        </MenuItem>
                      ))}
                    </Select>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1.4} sx={{ mb: 0.6 }}>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: "#f8b321",
                      }}
                    />
                    <Typography
                      sx={{ color: "rgba(237,240,247,0.72)", fontSize: 13 }}
                    >
                      {tt("Påmeldinger", "Enrollments")}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: "#8ea6d6",
                      }}
                    />
                    <Typography
                      sx={{ color: "rgba(237,240,247,0.72)", fontSize: 13 }}
                    >
                      {tt("Aktive studenter", "Active Students")}
                    </Typography>
                  </Stack>
                </Stack>

                <Box
                  sx={{
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                    borderRadius: 1,
                    bgcolor: "rgba(9,12,20,0.7)",
                    p: 0.8,
                  }}
                >
                  <Box
                    component="svg"
                    viewBox="0 0 680 260"
                    sx={{ width: "100%", height: 220, display: "block" }}
                  >
                    <defs>
                      <pattern
                        id="grid-growth"
                        width="68"
                        height="52"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 68 0 L 0 0 0 52"
                          fill="none"
                          stroke="rgba(255,255,255,0.07)"
                          strokeWidth="1"
                        />
                      </pattern>
                    </defs>
                    <rect
                      x="0"
                      y="0"
                      width="680"
                      height="260"
                      fill="url(#grid-growth)"
                    />
                    <path
                      d={growthEnrollPath}
                      fill="none"
                      stroke="#f8b321"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d={growthActivePath}
                      fill="none"
                      stroke="#8ea6d6"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </Box>
                </Box>

                <Typography
                  sx={{ mt: 0.8, mb: 0.4, color: "rgba(237,240,247,0.72)" }}
                >
                  {tt("Påmeldingskilder", "Enrollment Source")}
                </Typography>
                <Stack spacing={0.45}>
                  {sourceRows.map((source) => (
                    <Stack
                      key={source.id}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{
                        px: 0.7,
                        py: 0.55,
                        borderRadius: 1,
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                        bgcolor: "rgba(10,14,22,0.62)",
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 600 }}>
                          {source.label}
                        </Typography>
                        <Typography
                          sx={{ fontSize: 12, color: "rgba(237,240,247,0.6)" }}
                        >
                          {source.secondaryLabel}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography sx={{ color: "rgba(237,240,247,0.8)" }}>
                          {formatInteger(source.count)}
                        </Typography>
                        <Typography sx={{ color: "#9acd6f", fontWeight: 700 }}>
                          ▲ {source.changePct}%
                        </Typography>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Box>

              <Box sx={{ ...panelSx, p: 1 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 0.8 }}
                >
                  <Typography
                    sx={{ fontSize: 22, lineHeight: 1, fontWeight: 600 }}
                  >
                    {tt("Inntektsfordeling", "Revenue Breakdown")}
                  </Typography>
                  <Stack direction="row" spacing={0.8}>
                    <Select
                      size="small"
                      value={selectedCourseId}
                      onChange={(event) => {
                        const nextCourseId = String(event.target.value);
                        setSelectedCourseId(nextCourseId);
                        syncCourseIdInRoute(nextCourseId);
                      }}
                      sx={{
                        minWidth: 130,
                        color: "#edf0f7",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255,255,255,0.16)",
                        },
                      }}
                    >
                      <MenuItem value="all">
                        {tt("Alle kompetanser", "All competencies")}
                      </MenuItem>
                      {courses.map((course) => (
                        <MenuItem key={`rev-${course.id}`} value={course.id}>
                          {course.title}
                        </MenuItem>
                      ))}
                    </Select>
                    <Select
                      size="small"
                      value={revenueRange}
                      onChange={(event) =>
                        setRevenueRange(event.target.value as RangeFilter)
                      }
                      sx={{
                        minWidth: 130,
                        color: "#edf0f7",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255,255,255,0.16)",
                        },
                      }}
                    >
                      <MenuItem value="7d">
                        {tt("Siste 7 dager", "Last 7 days")}
                      </MenuItem>
                      <MenuItem value="30d">
                        {tt("Siste 30 dager", "Last 30 days")}
                      </MenuItem>
                      <MenuItem value="90d">
                        {tt("Siste 90 dager", "Last 90 days")}
                      </MenuItem>
                    </Select>
                  </Stack>
                </Stack>

                <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
                  <Box
                    sx={{
                      width: 210,
                      height: 210,
                      borderRadius: "50%",
                      background: revenueConic,
                      display: "grid",
                      placeItems: "center",
                      mx: { xs: "auto", md: 0 },
                      flexShrink: 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: 130,
                        height: 130,
                        borderRadius: "50%",
                        bgcolor: "#0f1420",
                        display: "grid",
                        placeItems: "center",
                        textAlign: "center",
                      }}
                    >
                      <Typography
                        sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}
                      >
                        {formatNok(revenueTotal)}
                      </Typography>
                      <Typography
                        sx={{ fontSize: 12, color: "rgba(237,240,247,0.62)" }}
                      >
                        {tt("Total inntekt", "Total Revenue")}
                      </Typography>
                    </Box>
                  </Box>

                  <Stack spacing={0.6} sx={{ flex: 1 }}>
                    {revenueBreakdown.map((row) => {
                      const ratio =
                        revenueTotal === 0
                          ? 0
                          : (row.value / revenueTotal) * 100;
                      return (
                        <Box key={row.id}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Stack
                              direction="row"
                              spacing={0.6}
                              alignItems="center"
                            >
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: "50%",
                                  bgcolor: row.color,
                                }}
                              />
                              <Typography>{row.label}</Typography>
                            </Stack>
                            <Typography sx={{ fontWeight: 700 }}>
                              {formatNok(row.value)}
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={ratio}
                            sx={{
                              mt: 0.45,
                              height: 6,
                              borderRadius: 999,
                              bgcolor: "rgba(255,255,255,0.14)",
                              "& .MuiLinearProgress-bar": {
                                borderRadius: 999,
                                background: row.color,
                              },
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                </Stack>

                <Box
                  sx={{
                    mt: 1,
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 1,
                  }}
                >
                  <Box>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mb: 0.5 }}
                    >
                      <Typography
                        sx={{ fontSize: 22, lineHeight: 1, fontWeight: 600 }}
                      >
                        {tt("Toppkurs", "Top Courses")}
                      </Typography>
                      <IconButton
                        size="small"
                        sx={{ color: "rgba(237,240,247,0.62)" }}
                      >
                        <MoreHoriz fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Stack spacing={0.6}>
                      {topCourses.map((course, index) => (
                        <Stack
                          key={course.id}
                          direction="row"
                          spacing={0.6}
                          alignItems="center"
                          sx={{
                            px: 0.6,
                            py: 0.6,
                            borderRadius: 1,
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                            bgcolor: "rgba(10,14,22,0.7)",
                          }}
                        >
                          <Box
                            sx={{
                              width: 42,
                              height: 42,
                              borderRadius: 1,
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                              background:
                                placeholderBackgrounds[
                                  (course.imageTheme + index) %
                                    placeholderBackgrounds.length
                                ],
                              flexShrink: 0,
                            }}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 600 }} noWrap>
                              {course.title}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: 12,
                                color: "rgba(237,240,247,0.64)",
                              }}
                              noWrap
                            >
                              {formatNok(course.revenue)}
                            </Typography>
                          </Box>
                          <Typography
                            sx={{ color: "#f8d56f", fontWeight: 700 }}
                          >
                            ▲ {course.growth}%
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>

                  <Box>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mb: 0.5 }}
                    >
                      <Typography
                        sx={{ fontSize: 22, lineHeight: 1, fontWeight: 600 }}
                      >
                        {tt("Toppprofiler", "Top Profiles")}
                      </Typography>
                      <IconButton
                        size="small"
                        sx={{ color: "rgba(237,240,247,0.62)" }}
                      >
                        <MoreHoriz fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Stack spacing={0.6}>
                      {topStudents.map((student, index) => (
                        <Stack
                          key={student.id}
                          direction="row"
                          spacing={0.6}
                          alignItems="center"
                          sx={{
                            px: 0.6,
                            py: 0.6,
                            borderRadius: 1,
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                            bgcolor: "rgba(10,14,22,0.7)",
                          }}
                        >
                          <Avatar
                            sx={{
                              width: 34,
                              height: 34,
                              background:
                                placeholderBackgrounds[
                                  (student.avatarTheme + index) %
                                    placeholderBackgrounds.length
                                ],
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                            }}
                          >
                            {student.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 600 }} noWrap>
                              {student.name}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: 12,
                                color: "rgba(237,240,247,0.64)",
                              }}
                              noWrap
                            >
                              {student.role}
                            </Typography>
                          </Box>
                          <Typography
                            sx={{ color: "#9acd6f", fontWeight: 700 }}
                          >
                            ▲ {student.growth}%
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box
              sx={{
                mt: 1,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 520px" },
                gap: 1,
              }}
            >
              <Box sx={{ ...panelSx, p: 1 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 0.8 }}
                >
                  <Typography
                    sx={{ fontSize: 22, lineHeight: 1, fontWeight: 600 }}
                  >
                    {tt("Kursengasjement", "Course Engagement")}
                  </Typography>
                  <Stack direction="row" spacing={0.8}>
                    <Chip
                      label={tt("Oversikt", "Overview")}
                      size="small"
                      sx={{
                        color: "#edf0f7",
                        bgcolor: "rgba(255,255,255,0.08)",
                      }}
                    />
                    <Chip
                      label={tt("Seertid", "Watch Time")}
                      size="small"
                      sx={{
                        color: "#edf0f7",
                        bgcolor: "rgba(248,179,33,0.12)",
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.34)",
                      }}
                    />
                  </Stack>
                </Stack>

                <Box
                  sx={{
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                    borderRadius: 1,
                    bgcolor: "rgba(9,12,20,0.7)",
                    p: 0.8,
                  }}
                >
                  <Box
                    component="svg"
                    viewBox="0 0 680 220"
                    sx={{ width: "100%", height: 200, display: "block" }}
                  >
                    <defs>
                      <pattern
                        id="grid-engagement"
                        width="68"
                        height="44"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 68 0 L 0 0 0 44"
                          fill="none"
                          stroke="rgba(255,255,255,0.07)"
                          strokeWidth="1"
                        />
                      </pattern>
                    </defs>
                    <rect
                      x="0"
                      y="0"
                      width="680"
                      height="220"
                      fill="url(#grid-engagement)"
                    />
                    <path
                      d={engagementWatchPath}
                      fill="none"
                      stroke="#f8b321"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d={engagementCompletionPath}
                      fill="none"
                      stroke="#8ea6d6"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </Box>
                </Box>

                <Stack direction="row" spacing={2} sx={{ mt: 0.7 }}>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: "#f8b321",
                      }}
                    />
                    <Typography
                      sx={{ color: "rgba(237,240,247,0.72)", fontSize: 13 }}
                    >
                      {tt("Gj.sn. seertid", "Avg Watch Time")}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: "#8ea6d6",
                      }}
                    />
                    <Typography
                      sx={{ color: "rgba(237,240,247,0.72)", fontSize: 13 }}
                    >
                      {tt(
                        "Fullføringsrate per ferdighet",
                        "Skill Completion Rate",
                      )}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>

              <Box sx={{ ...panelSx, p: 1 }}>
                <Typography
                  sx={{ fontSize: 22, lineHeight: 1, fontWeight: 600 }}
                >
                  {tt("Innsikt og tips", "Insights & Tips")}
                </Typography>

                <Stack spacing={0.8} sx={{ mt: 1 }}>
                  <Stack direction="row" spacing={0.7} alignItems="center">
                    <ShowChart sx={{ color: "#f8d56f" }} />
                    <Typography>
                      {tt(
                        "Kursalget er opp 21.6% sammenlignet med de siste 30 dagene.",
                        "Course sales up 21.6% compared to last 30 days.",
                      )}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.7} alignItems="center">
                    <TrendingUp sx={{ color: "#9acd6f" }} />
                    <Typography>
                      {tt(
                        "Fullføringsrate per ferdighet har økt 10% på tvers av aktive kohorter.",
                        "Skill completion rate improved by 10% across active cohorts.",
                      )}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.7} alignItems="center">
                    <Assessment sx={{ color: "#8ea6d6" }} />
                    <Typography>
                      Consider adding bonus content or community Q&amp;A
                      sessions to further boost engagement.
                    </Typography>
                  </Stack>
                </Stack>

                <Box
                  sx={{
                    mt: 1.1,
                    p: 0.9,
                    borderRadius: 1,
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.26)",
                    background: "rgba(248,179,33,0.08)",
                  }}
                >
                  <Typography sx={{ color: "#f8d56f", fontWeight: 700 }}>
                    Next Best Action
                  </Typography>
                  <Typography sx={{ mt: 0.4, color: "rgba(237,240,247,0.82)" }}>
                    {tt(
                      "Promoter den best presterende kompetansen og planlegg én live feedback-økt denne uken.",
                      "Promote the top performing competency and schedule one live feedback session this week.",
                    )}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyAnalyticsStudio, {
  componentId: "academy-analytics-studio",
  componentName: "Academy Analytics Studio",
  componentType: "dashboard",
  componentCategory: "academy",
  featureIds: [
    "analytics-dashboard",
    "revenue-analytics",
    "engagement-tracking",
    "academy-growth-metrics",
  ],
});
