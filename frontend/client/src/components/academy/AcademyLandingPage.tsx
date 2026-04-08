import React, { useCallback, useMemo, useState } from "react";
import {
  alpha,
  Box,
  Button,
  Chip,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowForward,
  Assessment,
  AutoAwesome,
  Campaign,
  Edit,
  Groups,
  MonetizationOn,
  MovieCreation,
  OndemandVideo,
  PlayArrow,
  Quiz,
  Search,
  Security,
  Subtitles,
  ViewModule,
} from "@mui/icons-material";
import { useLocation } from "wouter";
import {
  useAcademyContext,
  type Course,
  type Lesson,
} from "@/contexts/AcademyContext";
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { withUniversalIntegration } from "@/integration/UniversalIntegrationHOC";
import { withVisualEditor } from "@/components/admin/visual-editor/withVisualEditor";
import { useAcademyLocale } from "./academyLocale";
import AcademyLocaleSwitcher from "./AcademyLocaleSwitcher";
import AcademyBrandMark from "./AcademyBrandMark";
import AcademyLoginModal from "./AcademyLoginModal";
import PublicSocialLinks from "@/components/common/PublicSocialLinks";
import {
  getPublicSocialProfiles,
  resolvePublicBrandFromWindow,
} from "@/lib/publicBrandLinks";
import { resolveCreatorHubAcademyAudience } from "@/lib/creatorhubGoogleAuth";

interface LandingCourse {
  id: string;
  title: string;
  summaryNo: string;
  summaryEn: string;
  instructor: string;
  durationLabel: string;
  progress: number;
  thumbnail: string;
}

interface ToolCard {
  titleNo: string;
  titleEn: string;
  descriptionNo: string;
  descriptionEn: string;
  route: string;
  icon: React.ReactNode;
  badge: string;
}

interface ExperienceCard {
  titleNo: string;
  titleEn: string;
  descriptionNo: string;
  descriptionEn: string;
  route: string;
  actionNo: string;
  actionEn: string;
  icon: React.ReactNode;
  badge: string;
}

const PLACEHOLDER_BACKDROPS = [
  "linear-gradient(145deg, rgba(24,28,38,0.88), rgba(14,17,24,0.95)), radial-gradient(circle at 80% 20%, rgba(245,165,35,0.35), rgba(0,0,0,0))",
  "linear-gradient(145deg, rgba(20,24,33,0.9), rgba(12,15,21,0.96)), radial-gradient(circle at 20% 80%, rgba(245,165,35,0.28), rgba(0,0,0,0))",
  "linear-gradient(145deg, rgba(18,22,31,0.9), rgba(10,14,20,0.96)), radial-gradient(circle at 85% 10%, rgba(105,145,255,0.22), rgba(0,0,0,0))",
  "linear-gradient(145deg, rgba(24,21,17,0.88), rgba(14,13,12,0.96)), radial-gradient(circle at 80% 20%, rgba(245,165,35,0.28), rgba(0,0,0,0))",
];

const DEFAULT_COURSES: LandingCourse[] = [
  {
    id: "placeholder-directing",
    title: "Directing Masterclass",
    summaryNo: "Praktisk regi, blokkering og visuell historiefortelling.",
    summaryEn: "Practical directing, blocking, and visual storytelling.",
    instructor: "CreatorHub Team",
    durationLabel: "68 min",
    progress: 72,
    thumbnail: "/assets/academy/placeholders/placeholder-directing.png",
  },
  {
    id: "placeholder-lighting",
    title: "Lighting Fundamentals",
    summaryNo: "Tre-punkts lys og setups for studio og location.",
    summaryEn: "Three-point lighting setups for studio and location work.",
    instructor: "CreatorHub Team",
    durationLabel: "54 min",
    progress: 56,
    thumbnail: "/assets/academy/placeholders/placeholder-lighting.png",
  },
  {
    id: "placeholder-editing",
    title: "Editing Essentials",
    summaryNo: "Rytme, flyt og klippegrep for profesjonelle leveranser.",
    summaryEn:
      "Rhythm, flow, and editing techniques for professional delivery.",
    instructor: "CreatorHub Team",
    durationLabel: "42 min",
    progress: 44,
    thumbnail: "/assets/academy/placeholders/placeholder-editing.png",
  },
];

const CORE_FEATURES: ToolCard[] = [
  {
    titleNo: "Profesjonell videospiller",
    titleEn: "Professional Video Player",
    descriptionNo:
      "Kapitler, undertekster, transkripsjoner, hurtigtaster og avspillingskontroller.",
    descriptionEn:
      "Chapters, subtitles, transcripts, hotkeys, and playback controls.",
    route: "/academy/player-studio",
    icon: <OndemandVideo />,
    badge: "PLAYER",
  },
  {
    titleNo: "Quiz Studio",
    titleEn: "Quiz Studio",
    descriptionNo:
      "Spørsmål i video med karakterretur og elementanalyse for å måle læring.",
    descriptionEn:
      "In-video questions with graded feedback and response analytics.",
    route: "/academy/quiz-manager",
    icon: <Quiz />,
    badge: "QUIZ",
  },
  {
    titleNo: "Annoteringsstudio",
    titleEn: "Annotation Studio",
    descriptionNo:
      "Tidsstemplede notater, tegning og gjennomgangsarbeidsflyter for samarbeidende undervisning.",
    descriptionEn:
      "Timestamped notes, drawing, and collaborative review workflows.",
    route: "/academy/annotation-editor",
    icon: <Edit />,
    badge: "ANNOTATE",
  },
  {
    titleNo: "Læreplan",
    titleEn: "Curriculum",
    descriptionNo:
      "Bygg kursgrunnlag med formål, målgruppe, kompetansekart, læringsreise og bevis på læring.",
    descriptionEn:
      "Build course foundation with purpose, audience, competency map, learning journey, and proof of learning.",
    route: "/academy/curriculum",
    icon: <ViewModule />,
    badge: "FOUNDATION",
  },
  {
    titleNo: "Analyser som betyr noe",
    titleEn: "Actionable Analytics",
    descriptionNo:
      "Frafalls-varmekart, fullføringsrater, kohortsammenligninger og kvalitetsmålinger.",
    descriptionEn:
      "Drop-off heatmaps, completion rates, cohort comparisons, and quality metrics.",
    route: "/academy/analytics",
    icon: <Assessment />,
    badge: "INSIGHTS",
  },
  {
    titleNo: "Personvern og sikkerhet",
    titleEn: "Privacy & Security",
    descriptionNo:
      "SSO, rollebasert tilgang, signerte URL-er/DRM, revisjonslogger og GDPR-kontroller.",
    descriptionEn:
      "SSO, role-based access, signed URLs/DRM, audit logs, and GDPR controls.",
    route: "/academy/settings",
    icon: <Security />,
    badge: "SECURE",
  },
];

const NEW_STUDIO_TOOLS: ToolCard[] = [
  {
    titleNo: "Ferdighetsbygger",
    titleEn: "Skills Builder",
    descriptionNo:
      "Knyt ferdigheter, mediaflyt, publisering og leveranse til kursgrunnlaget.",
    descriptionEn:
      "Connect skills, media flow, publishing, and delivery to the course foundation.",
    route: "/academy/course-creator",
    icon: <MovieCreation />,
    badge: "STUDIO",
  },
  {
    titleNo: "Monetisering",
    titleEn: "Monetization",
    descriptionNo:
      "Prisstrategi, bundles, coupons, affiliate og inntektsanalyse.",
    descriptionEn:
      "Pricing strategy, bundles, coupons, affiliates, and revenue analytics.",
    route: "/academy/monetization",
    icon: <MonetizationOn />,
    badge: "REVENUE",
  },
  {
    titleNo: "CTA-Studio",
    titleEn: "CTA Studio",
    descriptionNo: "A/B-test CTA overlays i video med konverteringsinnsikt.",
    descriptionEn: "A/B test CTA overlays in video with conversion insights.",
    route: "/academy/cta-overlay",
    icon: <Campaign />,
    badge: "CTA",
  },
  {
    titleNo: "Lower thirds-studio",
    titleEn: "Lower Thirds Studio",
    descriptionNo:
      "Bygg branded lower thirds med timing, style og safe guides.",
    descriptionEn:
      "Build branded lower thirds with timing, style, and safe guides.",
    route: "/academy/lower-thirds",
    icon: <Subtitles />,
    badge: "BRANDING",
  },
  {
    titleNo: "Oppgaver",
    titleEn: "Assignments",
    descriptionNo:
      "Opprett oppgaver, følg progresjon og gi strukturerte tilbakemeldinger.",
    descriptionEn:
      "Create assignments, track progress, and provide structured feedback.",
    route: "/academy/assignments",
    icon: <AutoAwesome />,
    badge: "LEARNING",
  },
  {
    titleNo: "Påmelding og kohorter",
    titleEn: "Enrollment & Cohorts",
    descriptionNo: "Administrer kohorter, påmeldingsregler og release-planer.",
    descriptionEn: "Manage cohorts, enrollment rules, and release plans.",
    route: "/academy/enrollment",
    icon: <Groups />,
    badge: "OPERATIONS",
  },
  {
    titleNo: "Instruktøradmin",
    titleEn: "Instructor Admin",
    descriptionNo:
      "Administrer instruktørregister, fagansvarlig per kompetanse og instruktør per ferdighet.",
    descriptionEn:
      "Manage instructor roster, competency lead ownership, and instructor assignment per skill.",
    route: "/academy/instructors",
    icon: <Groups />,
    badge: "ROLES",
  },
];

const ROLE_EXPERIENCES: ExperienceCard[] = [
  {
    titleNo: "Studentvisning",
    titleEn: "Student Experience",
    descriptionNo:
      "Mine kurs, neste ferdighet, bokmerker, notater, progresjon og sertifikater i en ren læringsflate.",
    descriptionEn:
      "My courses, next skill, bookmarks, notes, progress, and certificates in a focused learner interface.",
    route: "/academy/student-dashboard",
    actionNo: "Åpne studentsiden",
    actionEn: "Open student view",
    icon: <OndemandVideo />,
    badge: "STUDENT",
  },
  {
    titleNo: "Instruktørstudio",
    titleEn: "Instructor Studio",
    descriptionNo:
      "Kursgrunnlag, ferdighetsbygger, analytics, cohorts og publisering samlet i produksjonsflaten for academy.",
    descriptionEn:
      "Course foundation, skills builder, analytics, cohorts, and publishing gathered in the academy production surface.",
    route: "/academy-dashboard",
    actionNo: "Åpne instruktørstudio",
    actionEn: "Open instructor studio",
    icon: <MovieCreation />,
    badge: "INSTRUCTOR",
  },
];

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 min";
  return `${Math.max(1, Math.round(seconds / 60))} min`;
};

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const addMetricLabel = (target: Set<string>, value: unknown): void => {
  const normalized = String(value || "").trim();
  if (normalized) {
    target.add(normalized);
  }
};

const resolveInstructor = (course: Course): string => {
  if (typeof course.instructor === "string") return course.instructor;
  return course.instructor?.name || "CreatorHub Team";
};

const firstLesson = (course: Course): Lesson | null => {
  if (!Array.isArray(course.lessons) || course.lessons.length === 0)
    return null;
  const sorted = [...course.lessons].sort(
    (a, b) => Number(a.order || 0) - Number(b.order || 0),
  );
  return sorted[0] || course.lessons[0] || null;
};

function AcademyLandingPage() {
  const [, setLocation] = useLocation();
  const {
    state,
    filteredCourses,
    setSearchQuery,
    setCurrentCourse,
    setCurrentLesson,
  } = useAcademyContext();
  const { analytics, auth } = useEnhancedMasterIntegration();
  const { tt } = useAcademyLocale();

  const [search, setSearch] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const isAcademyAuthenticated = Boolean(
    auth.state.isAuthenticated && auth.state.user,
  );
  const academyAudience = useMemo(
    () => resolveCreatorHubAcademyAudience(auth.state.user ?? null),
    [auth.state.user],
  );
  const academyEntryRoute =
    academyAudience === "student" ? "/academy/student-dashboard" : "/academy-dashboard";
  const academyEntryLabel = tt("Åpne Academy", "Open Academy");
  const socialLinks = useMemo(
    () =>
      getPublicSocialProfiles(resolvePublicBrandFromWindow()).filter((link) =>
        String(link.href || "").trim(),
      ),
    [],
  );

  const allCourses = useMemo(() => {
    return filteredCourses.length > 0 ? filteredCourses : state.courses;
  }, [filteredCourses, state.courses]);

  const mappedCourses = useMemo<LandingCourse[]>(() => {
    if (allCourses.length === 0) return DEFAULT_COURSES;

    return allCourses.map((course, index) => {
      const progressRows = state.progress.filter(
        (row) => row.courseId === course.id,
      );
      const avgProgress =
        progressRows.length > 0
          ? Math.round(
              progressRows.reduce(
                (sum, row) => sum + Number(row.progress || 0),
                0,
              ) / progressRows.length,
            )
          : Math.max(15, 74 - index * 8);

      return {
        id: course.id,
        title: course.title,
        summaryNo: course.description || "Kursbeskrivelse kommer snart.",
        summaryEn: course.description || "Course description coming soon.",
        instructor: resolveInstructor(course),
        durationLabel: formatDuration(course.duration || 0),
        progress: Math.min(100, Math.max(0, avgProgress)),
        thumbnail: course.thumbnail || "",
      };
    });
  }, [allCourses, state.progress]);

  const visibleCourses = useMemo(() => {
    if (!search.trim()) return mappedCourses;
    const query = search.trim().toLowerCase();
    return mappedCourses.filter((course) => {
      return (
        course.title.toLowerCase().includes(query) ||
        tt(course.summaryNo, course.summaryEn).toLowerCase().includes(query) ||
        course.instructor.toLowerCase().includes(query)
      );
    });
  }, [mappedCourses, search, tt]);

  const heroCourse =
    visibleCourses[0] || mappedCourses[0] || DEFAULT_COURSES[0];

  const totals = useMemo(() => {
    const uniqueSkills = new Set<string>();
    let lessonCount = 0;

    allCourses.forEach((course) => {
      if (Array.isArray(course.lessons)) {
        lessonCount += course.lessons.length;
        course.lessons.forEach((lesson) => addMetricLabel(uniqueSkills, lesson.title));
      }

      course.learningOutcomes?.forEach((outcome) =>
        addMetricLabel(uniqueSkills, outcome),
      );
      course.pedagogicalArchitecture?.skills?.forEach((skill) =>
        addMetricLabel(uniqueSkills, skill),
      );
      course.pedagogicalArchitecture?.competencies?.forEach((competency) =>
        addMetricLabel(uniqueSkills, competency),
      );
      course.pedagogicalArchitecture?.skillMap?.forEach((item) =>
        addMetricLabel(uniqueSkills, item.title),
      );
    });

    const skills = uniqueSkills.size || lessonCount || 0;

    const uniqueStudents = new Set(
      state.enrollments
        .map((enrollment) => String(enrollment.studentId || "").trim())
        .filter(Boolean),
    );
    const studentsFromCourses = allCourses.reduce((sum, course) => {
      return sum + (toPositiveNumber(course.studentCount) ?? 0);
    }, 0);
    const students = Math.max(uniqueStudents.size, studentsFromCourses) || 0;

    const ratings = allCourses
      .map((course) => toPositiveNumber(course.rating))
      .filter((value): value is number => value !== null);
    const avgRating =
      ratings.length > 0
        ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1)
        : "0.0";

    const completionValues = state.progress
      .map((row) => Number(row.progress))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const avgCompletion =
      completionValues.length > 0
        ? Math.round(
            completionValues.reduce((sum, value) => sum + value, 0) /
              completionValues.length,
          )
        : 0;

    return {
      skills,
      students,
      avgRating,
      avgCompletion,
    };
  }, [allCourses, state.enrollments, state.progress]);

  const formatMetricValue = useCallback(
    (value: number | string, suffix = ""): string => `${value}${suffix}`,
    [],
  );

  const goTo = useCallback(
    (route: string, eventName: string) => {
      analytics.trackEvent(eventName, {
        route,
        source: "academy-landing",
      });
      setLocation(route);
    },
    [analytics, setLocation],
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      setSearchQuery(value);
    },
    [setSearchQuery],
  );

  const openCourse = useCallback(
    (courseId: string) => {
      const match = allCourses.find((course) => course.id === courseId);
      if (!match) {
        goTo("/academy-dashboard", "academy_landing_fallback_dashboard");
        return;
      }

      const lesson = firstLesson(match);
      if (lesson) {
        setCurrentCourse(match);
        setCurrentLesson(lesson);
        goTo("/academy/player-studio", "academy_landing_open_video_player");
        return;
      }

      goTo("/academy-dashboard", "academy_landing_open_dashboard_no_lesson");
    },
    [allCourses, goTo, setCurrentCourse, setCurrentLesson],
  );

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
          position: "relative",
          zIndex: 1,
          width: "min(100%, var(--academy-shell-max-width, 1920px))",
          mx: "auto",
          px: { xs: 2, md: 3 },
          pb: 5,
        }}
      >
        <Box
          component="header"
          sx={{
            pt: 2,
            pb: 2,
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "380px minmax(320px,1fr) 280px",
            },
            gap: 2,
            alignItems: "center",
            borderBottom: `var(--academy-hairline-width, 1px) solid ${alpha("#f5a623", 0.18)}`,
          }}
        >
          <Stack spacing={0.6} alignItems="flex-start">
            <AcademyBrandMark width={{ xs: 214, sm: 236, md: 268 }} />
            <Typography sx={{ fontSize: 11, opacity: 0.58, pl: 0.5 }}>
              {tt(
                "Et produkt av CreatorHub Norge",
                "A product by CreatorHub Norway",
              )}
            </Typography>
          </Stack>

          <TextField
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder={tt(
              "Søk kurs, funksjoner, kompetanser...",
              "Search courses, features, competencies...",
            )}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: "rgba(248,241,231,0.65)" }} />
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "#f8f1e7",
                borderRadius: "10px",
                backgroundColor: "rgba(11, 15, 24, 0.85)",
                fontFamily: "Rajdhani, sans-serif",
                "& fieldset": { borderColor: "rgba(245,166,35,0.28)" },
                "&:hover fieldset": { borderColor: "rgba(245,166,35,0.45)" },
                "&.Mui-focused fieldset": { borderColor: "#f5a623" },
              },
            }}
          />

          <Stack
            direction="row"
            spacing={1}
            justifyContent={{ xs: "flex-start", lg: "flex-end" }}
            alignItems="center"
          >
            <AcademyLocaleSwitcher />
            {isAcademyAuthenticated ? (
              <Button
                variant="contained"
                onClick={() =>
                  goTo(academyEntryRoute, "academy_landing_open_authenticated_entry")
                }
                sx={{
                  textTransform: "none",
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 700,
                  borderRadius: "10px",
                  px: 2,
                  color: "#1e1306",
                  background:
                    "linear-gradient(180deg, #ffc64d 0%, #f5a623 100%)",
                  boxShadow: "0 8px 24px rgba(245,166,35,0.28)",
                }}
              >
                {academyEntryLabel}
              </Button>
            ) : (
              <Button
                variant="outlined"
                onClick={() => setLoginOpen(true)}
                sx={{
                  textTransform: "none",
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 700,
                  color: "#f8f1e7",
                  borderColor: "rgba(255,255,255,0.32)",
                }}
              >
                {tt("Logg inn", "Sign in")}
              </Button>
            )}
          </Stack>
        </Box>

        <Box
          sx={{
            mt: 3,
            borderRadius: "14px",
            border: `var(--academy-hairline-width, 1px) solid ${alpha("#f5a623", 0.2)}`,
            background:
              "radial-gradient(circle at 25% 15%, rgba(86,120,168,0.28), rgba(8,11,18,0.92) 45%), linear-gradient(135deg, rgba(7,10,17,0.9), rgba(5,7,13,0.98))",
            overflow: "hidden",
          }}
        >
          <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "1.05fr 1fr" },
                gap: 3,
                alignItems: "center",
              }}
            >
              <Box>
                <Typography
                  sx={{
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: { xs: "2rem", md: "3rem" },
                    lineHeight: 1,
                    letterSpacing: "0.01em",
                    mb: 1.3,
                  }}
                >
                  {tt(
                    "Velkommen til CreatorHub Academy",
                    "Welcome to CreatorHub Academy",
                  )}
                </Typography>
                <Typography
                  sx={{
                    opacity: 0.84,
                    mb: 1.2,
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  {tt(
                    "Academy har nå to tydelige innganger: en ren studentflate for læring og et instruktørstudio for bygging, drift og publisering.",
                    "Academy now has two clear entry points: a focused learner interface and an instructor studio for building, operations, and publishing.",
                  )}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{ mb: 2 }}
                >
                  <LinearProgress
                    variant="determinate"
                    value={heroCourse.progress}
                    sx={{
                      flex: 1,
                      height: 10,
                      borderRadius: 999,
                      bgcolor: "rgba(255,255,255,0.15)",
                      "& .MuiLinearProgress-bar": {
                        borderRadius: 999,
                        background:
                          "linear-gradient(90deg, #f5a623 0%, #ffbf47 100%)",
                      },
                    }}
                  />
                  <Typography
                    sx={{
                      minWidth: 112,
                      fontFamily: "Rajdhani, sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    {heroCourse.progress}% {tt("klar", "complete")}
                  </Typography>
                </Stack>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.2}
                  useFlexGap
                  flexWrap="wrap"
                >
                  <Button
                    variant="contained"
                    startIcon={<PlayArrow />}
                    onClick={() =>
                      goTo(
                        "/academy/student-dashboard",
                        "academy_landing_open_student_dashboard",
                      )
                    }
                    sx={{
                      textTransform: "none",
                      fontFamily: "Rajdhani, sans-serif",
                      fontWeight: 700,
                      borderRadius: "8px",
                      px: 2.2,
                      py: 1,
                      color: "#1e1306",
                      background:
                        "linear-gradient(180deg, #ffc64d 0%, #f5a623 100%)",
                      boxShadow: "0 8px 24px rgba(245,166,35,0.38)",
                    }}
                  >
                    {tt("Åpne studentsiden", "Open student view")}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      goTo(
                        "/academy-dashboard",
                        "academy_landing_open_instructor_dashboard",
                      )
                    }
                    sx={{
                      textTransform: "none",
                      fontFamily: "Rajdhani, sans-serif",
                      fontWeight: 700,
                      color: "#f8f1e7",
                      borderColor: "rgba(245,166,35,0.44)",
                    }}
                  >
                    {tt("Åpne instruktørstudio", "Open instructor studio")}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setLoginOpen(true)}
                    sx={{
                      textTransform: "none",
                      fontFamily: "Rajdhani, sans-serif",
                      fontWeight: 700,
                      color: "#f8f1e7",
                      borderColor: "rgba(255,255,255,0.32)",
                    }}
                  >
                    {tt("Logg inn", "Sign in")}
                  </Button>
                </Stack>
              </Box>

              <Box
                sx={{
                  position: "relative",
                  minHeight: { xs: 230, md: 300 },
                  borderRadius: "10px",
                  border:
                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                  overflow: "hidden",
                  background: heroCourse.thumbnail
                    ? `linear-gradient(180deg, rgba(5,8,12,0.08), rgba(4,6,10,0.82)), url(${heroCourse.thumbnail}) center / cover no-repeat`
                    : PLACEHOLDER_BACKDROPS[0],
                }}
              >
                <Box
                  sx={{ position: "absolute", left: 18, bottom: 18, right: 18 }}
                >
                  <Typography
                    sx={{
                      fontFamily: "Barlow Condensed, sans-serif",
                      fontSize: { xs: "1.5rem", md: "2rem" },
                      lineHeight: 0.95,
                    }}
                  >
                    {heroCourse.title}
                  </Typography>
                  <Typography sx={{ mt: 0.6, opacity: 0.76 }}>
                    {tt(heroCourse.summaryNo, heroCourse.summaryEn)}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.max(10, heroCourse.progress)}
                    sx={{
                      mt: 1.2,
                      height: 6,
                      borderRadius: 999,
                      bgcolor: "rgba(255,255,255,0.2)",
                      "& .MuiLinearProgress-bar": {
                        borderRadius: 999,
                        background:
                          "linear-gradient(90deg, #f5a623 0%, #ffd26a 100%)",
                      },
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            mt: 2.4,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" },
            gap: 2,
          }}
        >
          {ROLE_EXPERIENCES.map((item, index) => (
            <Box
              key={item.route}
              sx={{
                borderRadius: "12px",
                border: `var(--academy-hairline-width, 1px) solid ${alpha("#f5a623", 0.2)}`,
                background:
                  index === 0
                    ? "radial-gradient(circle at 85% 15%, rgba(245,166,35,0.18), rgba(0,0,0,0) 34%), rgba(7, 10, 16, 0.82)"
                    : "radial-gradient(circle at 15% 15%, rgba(96,132,201,0.18), rgba(0,0,0,0) 32%), rgba(7, 10, 16, 0.82)",
                p: 2,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Avatar
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: "rgba(245,166,35,0.18)",
                    color: "#ffd38c",
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.35)",
                  }}
                >
                  {item.icon}
                </Avatar>
                <Chip
                  label={item.badge}
                  size="small"
                  sx={{
                    color: "#fbe6be",
                    borderColor: "rgba(245,166,35,0.35)",
                    background: "rgba(245,166,35,0.16)",
                  }}
                />
              </Stack>

              <Typography
                sx={{
                  fontFamily: "Barlow Condensed, sans-serif",
                  fontSize: { xs: "1.7rem", md: "2rem" },
                  lineHeight: 1,
                }}
              >
                {tt(item.titleNo, item.titleEn)}
              </Typography>
              <Typography sx={{ mt: 0.7, opacity: 0.76, minHeight: 54 }}>
                {tt(item.descriptionNo, item.descriptionEn)}
              </Typography>

              <Button
                onClick={() => goTo(item.route, "academy_landing_open_role_entry")}
                endIcon={<ArrowForward />}
                sx={{
                  mt: 1.1,
                  textTransform: "none",
                  color: "#f8f1e7",
                  border:
                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)",
                  borderRadius: "8px",
                  px: 1.6,
                }}
              >
                {tt(item.actionNo, item.actionEn)}
              </Button>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            mt: 2.4,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" },
            gap: 2,
          }}
        >
          <Box
            sx={{
              borderRadius: "12px",
              border: `var(--academy-hairline-width, 1px) solid ${alpha("#f5a623", 0.2)}`,
              background: "rgba(7, 10, 16, 0.82)",
              p: 2,
            }}
          >
            <Typography
              sx={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: { xs: "1.55rem", md: "1.9rem" },
                mb: 1,
              }}
            >
              {tt("Kjernefunksjoner", "Core Features")}
            </Typography>
            <Stack spacing={1}>
              {CORE_FEATURES.map((item) => (
                <Button
                  key={item.route}
                  onClick={() =>
                    goTo(item.route, "academy_landing_open_core_feature")
                  }
                  sx={{
                    justifyContent: "space-between",
                    textTransform: "none",
                    color: "#f8f1e7",
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                    borderRadius: "10px",
                    px: 1.1,
                    py: 1.05,
                    background: "rgba(10,14,22,0.72)",
                    "&:hover": {
                      borderColor: "rgba(245,166,35,0.48)",
                      background: "rgba(245,166,35,0.1)",
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    minWidth={0}
                  >
                    <Avatar
                      sx={{
                        width: 30,
                        height: 30,
                        bgcolor: "rgba(245,166,35,0.2)",
                        color: "#ffd38c",
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.35)",
                      }}
                    >
                      {item.icon}
                    </Avatar>
                    <Box sx={{ textAlign: "left", minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {tt(item.titleNo, item.titleEn)}
                      </Typography>
                      <Typography sx={{ fontSize: 12, opacity: 0.72 }} noWrap>
                        {tt(item.descriptionNo, item.descriptionEn)}
                      </Typography>
                    </Box>
                  </Stack>
                  <Chip
                    label={item.badge}
                    size="small"
                    sx={{
                      color: "#fbe6be",
                      borderColor: "rgba(245,166,35,0.35)",
                      background: "rgba(245,166,35,0.16)",
                    }}
                  />
                </Button>
              ))}
            </Stack>
          </Box>

          <Box
            sx={{
              borderRadius: "12px",
              border: `var(--academy-hairline-width, 1px) solid ${alpha("#f5a623", 0.2)}`,
              background: "rgba(7, 10, 16, 0.82)",
              p: 2,
            }}
          >
            <Typography
              sx={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: { xs: "1.55rem", md: "1.9rem" },
                mb: 1,
              }}
            >
              {tt("Nye studio-funksjoner", "New Studio Features")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 1,
              }}
            >
              {NEW_STUDIO_TOOLS.map((item) => (
                <Box
                  key={item.route}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    goTo(item.route, "academy_landing_open_new_studio_tool")
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      goTo(item.route, "academy_landing_open_new_studio_tool");
                    }
                  }}
                  sx={{
                    borderRadius: "10px",
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                    p: 1.1,
                    cursor: "pointer",
                    background: "rgba(10,14,22,0.72)",
                    transition: "border-color .2s ease, transform .2s ease",
                    "&:hover": {
                      borderColor: "rgba(245,166,35,0.48)",
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        bgcolor: "rgba(245,166,35,0.2)",
                        color: "#ffd38c",
                        border:
                          "var(--academy-hairline-width, 1px) solid rgba(245,166,35,0.35)",
                      }}
                    >
                      {item.icon}
                    </Avatar>
                    <Typography sx={{ fontWeight: 700 }} noWrap>
                      {tt(item.titleNo, item.titleEn)}
                    </Typography>
                  </Stack>
                  <Typography sx={{ mt: 0.7, fontSize: 12, opacity: 0.72 }}>
                    {tt(item.descriptionNo, item.descriptionEn)}
                  </Typography>
                  <Chip
                    label={item.badge}
                    size="small"
                    sx={{
                      mt: 0.8,
                      color: "#fbe6be",
                      borderColor: "rgba(245,166,35,0.35)",
                      background: "rgba(245,166,35,0.16)",
                    }}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Box sx={{ mt: 2.6 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1.1 }}
          >
            <Typography
              sx={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: { xs: "1.55rem", md: "1.9rem" },
              }}
            >
              {tt("Kurs med eksisterende data", "Courses with Existing Data")}
            </Typography>
            <Button
              onClick={() =>
                goTo("/academy-dashboard", "academy_landing_see_all_courses")
              }
              endIcon={<ArrowForward />}
              sx={{
                textTransform: "none",
                color: "#f8f1e7",
                border:
                  "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.22)",
                borderRadius: "8px",
              }}
            >
              {tt("Se alle", "See all")}
            </Button>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2,1fr)",
                xl: "repeat(3,1fr)",
              },
              gap: 1.3,
            }}
          >
            {visibleCourses.slice(0, 6).map((course, index) => (
              <Box
                key={course.id}
                sx={{
                  borderRadius: "11px",
                  border: `var(--academy-hairline-width, 1px) solid ${alpha("#f5a623", 0.2)}`,
                  overflow: "hidden",
                  background: "rgba(8, 11, 18, 0.86)",
                }}
              >
                <Box
                  sx={{
                    height: 152,
                    background: course.thumbnail
                      ? `linear-gradient(180deg, rgba(8,11,17,0.05), rgba(6,8,12,0.78)), url(${course.thumbnail}) center / cover no-repeat`
                      : PLACEHOLDER_BACKDROPS[
                          index % PLACEHOLDER_BACKDROPS.length
                        ],
                  }}
                />
                <Box sx={{ p: 1.25 }}>
                  <Typography
                    sx={{
                      fontFamily: "Barlow Condensed, sans-serif",
                      fontSize: "1.5rem",
                      lineHeight: 1,
                    }}
                  >
                    {course.title}
                  </Typography>
                  <Typography sx={{ mt: 0.5, opacity: 0.72 }}>
                    {tt(course.summaryNo, course.summaryEn)}
                  </Typography>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    sx={{ mt: 0.7 }}
                  >
                    <Typography sx={{ fontSize: 12, opacity: 0.84 }}>
                      {course.instructor}
                    </Typography>
                    <Typography sx={{ fontSize: 12, opacity: 0.84 }}>
                      {course.durationLabel}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={course.progress}
                    sx={{
                      mt: 1,
                      height: 5,
                      borderRadius: 999,
                      bgcolor: "rgba(255,255,255,0.18)",
                      "& .MuiLinearProgress-bar": {
                        borderRadius: 999,
                        background:
                          "linear-gradient(90deg, #f5a623 0%, #ffcd67 100%)",
                      },
                    }}
                  />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            mt: 2.4,
            p: 1.6,
            borderRadius: "10px",
            border: `var(--academy-hairline-width, 1px) solid ${alpha("#f5a623", 0.2)}`,
            background: "rgba(7, 10, 16, 0.8)",
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
            gap: 1,
          }}
        >
          <Box>
            <Typography sx={{ opacity: 0.68, fontSize: 12 }}>
              {tt("Totale ferdigheter", "Total Skills")}
            </Typography>
            <Typography
              sx={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: "2rem",
                lineHeight: 1,
              }}
            >
              {formatMetricValue(totals.skills)}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ opacity: 0.68, fontSize: 12 }}>
              {tt("Totale studenter", "Total Students")}
            </Typography>
            <Typography
              sx={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: "2rem",
                lineHeight: 1,
              }}
            >
              {formatMetricValue(totals.students)}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ opacity: 0.68, fontSize: 12 }}>
              {tt("Snittvurdering", "Avg Rating")}
            </Typography>
            <Typography
              sx={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: "2rem",
                lineHeight: 1,
              }}
            >
              {formatMetricValue(totals.avgRating)}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ opacity: 0.68, fontSize: 12 }}>
              {tt("Snittfullføring", "Avg Completion")}
            </Typography>
            <Typography
              sx={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: "2rem",
                lineHeight: 1,
              }}
            >
              {formatMetricValue(totals.avgCompletion, "%")}
            </Typography>
          </Box>
        </Box>

        {socialLinks.length > 0 ? (
          <PublicSocialLinks
            label={tt("Sosiale medier", "Social media")}
            body={tt(
              `Følg CreatorHub Academy i ${socialLinks.length} aktive kanaler for nye kurs, lanseringer og oppdateringer fra plattformen.`,
              `Follow CreatorHub Academy across ${socialLinks.length} active channels for new courses, launches, and platform updates.`,
            )}
            links={socialLinks}
            tone="creatorhub"
            sx={{
              mt: 2.2,
              p: 1.6,
              borderRadius: "10px",
              border: `var(--academy-hairline-width, 1px) solid ${alpha("#f5a623", 0.2)}`,
              background: "rgba(7, 10, 16, 0.8)",
            }}
          />
        ) : null}
      </Box>

      <AcademyLoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
      />
    </Box>
  );
}

const AcademyLandingPageWithVisualEditor = withVisualEditor(
  AcademyLandingPage,
  {
    componentId: "academy-landing",
    componentName: "Academy Home",
    category: "academy",
    editable: true,
    previewable: true,
    templateable: true,
    propsEditable: true,
  },
);

export default withUniversalIntegration(AcademyLandingPageWithVisualEditor, {
  componentId: "academy-landing-page",
  componentName: "Academy Home",
  componentType: "page",
  componentCategory: "academy",
  featureIds: [
    "academy-dashboard",
    "course-creation",
    "course-analytics",
    "video-player",
  ],
});
