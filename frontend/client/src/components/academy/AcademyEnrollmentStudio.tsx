import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  Assessment,
  Download,
  Edit,
  MailOutline,
  MoreHoriz,
  NotificationsNone,
  Publish,
  Save,
  Search,
} from "@mui/icons-material";
import { useLocation } from "wouter";
import {
  useAcademy,
  type Course,
  type Enrollment,
} from "@/contexts/AcademyContext";
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { withUniversalIntegration } from "@/integration/UniversalIntegrationHOC";
import { academyPdfExportService } from "@/services/academyPdfExportService";
import { apiRequest } from "@/lib/queryClient";
import { useAcademyLocale } from "./academyLocale";
import AcademyLocaleSwitcher from "./AcademyLocaleSwitcher";
import AcademyLeftSidebar from "./AcademyLeftSidebar";

interface AcademyEnrollmentStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type RangeFilter = "7d" | "30d" | "90d";
type CompletionFilter = "all" | "high" | "mid" | "low";

interface StudentEnrollmentItem {
  id: string;
  name: string;
  email?: string;
  role: string;
  primaryCohort: string;
  primaryCourseId: string;
  courseIds: string[];
  sourceCount: number;
  completionRate: number;
  enrolledScore: number;
  tags: string[];
  avatarTheme: number;
  enrolledAt: string;
  subscriptionPlanId?: string;
  subscriptionPlanName?: string;
  subscriptionPlanPrice?: number;
  isManual?: boolean;
  inviteRequestId?: string;
}

interface ActivityItem {
  id: string;
  author: string;
  course: string;
  action: string;
  timestamp: string;
}

interface AddStudentFormState {
  name: string;
  email: string;
  role: string;
  courseId: string;
  tags: string;
  subscriptionPlanId: string;
}

interface TopCohortItem {
  id: string;
  name: string;
  students: number;
  avgCompletion: number;
  imageTheme: number;
}

interface InviteRequestItem {
  id: string;
  profession?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  business?: string | null;
  status?: string | null;
  requestDate?: string | null;
  processedDate?: string | null;
  selectedPlan?: string | null;
  planName?: string | null;
  planPrice?: number | null;
  source?: string | null;
}

interface SubscriptionPlanOption {
  id: string;
  labelNo: string;
  labelEn: string;
  monthlyPriceNok: number | null;
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

const toNok = (value: number): string =>
  new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

const toCompactNumber = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.max(0, value));

const isLandingEnrollmentSource = (source: string | null | undefined): boolean => {
  if (!source) return true;
  const normalized = String(source).toLowerCase();
  return normalized.includes("landing") || normalized.includes("academy");
};

const displayNameFromInviteRequest = (
  request: InviteRequestItem,
  fallbackIndex: number,
): string => {
  const fullName = `${request.firstName || ""} ${request.lastName || ""}`.trim();
  if (fullName.length > 0) return fullName;
  if (request.email) return displayNameFromStudentId(request.email, fallbackIndex);
  return `Applicant ${fallbackIndex + 1}`;
};

const displayNameFromStudentId = (studentId: string, index: number): string => {
  const normalized = String(studentId || "").trim();
  if (!normalized) return `Student ${index + 1}`;
  const beforeAt = normalized.includes("@")
    ? normalized.split("@")[0]
    : normalized;
  const parts = beforeAt
    .replace(/[_.]+/g, "-")
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return `Student ${index + 1}`;
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const parseTagList = (value: string): string[] =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const progressFromEnrollment = (enrollment: Enrollment): number => {
  if (!Array.isArray(enrollment.progress) || enrollment.progress.length === 0)
    return 0;
  const total = enrollment.progress.reduce(
    (sum, item) => sum + Number(item?.progress || 0),
    0,
  );
  return Math.round(total / enrollment.progress.length);
};

const buildStudentsFromEnrollments = (
  enrollments: Enrollment[],
  courses: Course[],
): StudentEnrollmentItem[] => {
  const grouped = new Map<
    string,
    {
      courseIds: string[];
      cohortNames: string[];
      progressValues: number[];
      enrolledAt: string;
    }
  >();

  enrollments.forEach((enrollment, index) => {
    const studentId = String(enrollment?.studentId || `student-${index}`);
    const entry = grouped.get(studentId) || {
      courseIds: [],
      cohortNames: [],
      progressValues: [],
      enrolledAt: enrollment?.enrolledAt || new Date().toISOString(),
    };

    const courseId = String(enrollment?.courseId || "");
    if (courseId && !entry.courseIds.includes(courseId)) {
      entry.courseIds.push(courseId);
      const matchingCourse = courses.find(
        (course) => String(course.id) === courseId,
      );
      if (matchingCourse?.title) {
        entry.cohortNames.push(matchingCourse.title);
      }
    }

    entry.progressValues.push(progressFromEnrollment(enrollment));

    if (
      new Date(enrollment?.enrolledAt || 0).getTime() >
      new Date(entry.enrolledAt).getTime()
    ) {
      entry.enrolledAt = enrollment.enrolledAt;
    }

    grouped.set(studentId, entry);
  });

  return Array.from(grouped.entries()).map(([studentId, entry], index) => {
    const completionRate =
      entry.progressValues.length === 0
        ? 0
        : Math.round(
            entry.progressValues.reduce((sum, value) => sum + value, 0) /
              entry.progressValues.length,
          );

    const primaryCourseId =
      entry.courseIds[0] || String(courses[0]?.id || `course-${index}`);
    const primaryCourse = courses.find(
      (course) => String(course.id) === String(primaryCourseId),
    );

    return {
      id: `academy-enrollment-${studentId}`,
      name: displayNameFromStudentId(studentId, index),
      email: studentId.includes("@") ? studentId : "",
      role: primaryCourse?.level
        ? `${primaryCourse.level.charAt(0).toUpperCase()}${primaryCourse.level.slice(1)} Learner`
        : "Learner",
      primaryCohort:
        primaryCourse?.title || entry.cohortNames[0] || "Academy Cohort",
      primaryCourseId: String(primaryCourseId),
      courseIds: entry.courseIds,
      sourceCount: Math.max(1, entry.courseIds.length * 2),
      completionRate,
      enrolledScore: Math.max(
        80,
        completionRate * Math.max(1, entry.courseIds.length),
      ),
      tags:
        completionRate >= 85
          ? ["Top Performer"]
          : completionRate >= 65
            ? ["Active"]
            : ["Needs Follow-up"],
      avatarTheme: index % placeholderBackgrounds.length,
      enrolledAt: entry.enrolledAt,
    };
  });
};

function AcademyEnrollmentStudio({
  courseId,
  onSave,
}: AcademyEnrollmentStudioProps) {
  const [location, setLocation] = useLocation();
  const { state, getCourse, updateCourse, setCurrentCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();

  const { navLabel, tt, language } = useAcademyLocale();

  const [leftNav, setLeftNav] = useState("enrollment");
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || "all");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("30d");
  const [completionFilter, setCompletionFilter] =
    useState<CompletionFilter>("all");
  const [searchValue, setSearchValue] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const [manualStudents, setManualStudents] = useState<StudentEnrollmentItem[]>(
    [],
  );
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [addStudentForm, setAddStudentForm] = useState<AddStudentFormState>({
    name: "",
    email: "",
    role: "",
    courseId: "",
    tags: "",
    subscriptionPlanId: "",
  });
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentOverrides, setStudentOverrides] = useState<
    Record<string, Partial<StudentEnrollmentItem>>
  >({});
  const [hiddenStudentIds, setHiddenStudentIds] = useState<string[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [featureFlags, setFeatureFlags] = useState({
    earlyAccess: true,
    invitationOnly: true,
    closed: false,
    dripRelease: false,
  });
  const [processingInviteRequestId, setProcessingInviteRequestId] = useState<
    string | null
  >(null);
  const queryClient = useQueryClient();

  const courseItems = useMemo(() => {
    if (Array.isArray(state?.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return [];
  }, [state?.courses]);

  const subscriptionPlanOptions = useMemo<SubscriptionPlanOption[]>(
    () => [
      {
        id: "basic",
        labelNo: "Basic Creator",
        labelEn: "Basic Creator",
        monthlyPriceNok: 299,
      },
      {
        id: "pro",
        labelNo: "Pro Creator",
        labelEn: "Pro Creator",
        monthlyPriceNok: 599,
      },
      {
        id: "enterprise",
        labelNo: "Creator Teams",
        labelEn: "Creator Teams",
        monthlyPriceNok: 1499,
      },
    ],
    [],
  );

  const academyEnrollments = useMemo(
    () => (Array.isArray(state?.enrollments) ? state.enrollments : []),
    [state?.enrollments],
  );

  const { data: inviteRequests = [], isLoading: inviteRequestsLoading } =
    useQuery<InviteRequestItem[]>({
      queryKey: ["academy-enrollment-invite-requests"],
      queryFn: async () => {
        const result = await apiRequest("/api/invite-requests");
        return Array.isArray(result) ? (result as InviteRequestItem[]) : [];
      },
      staleTime: 30_000,
    });

  const landingInviteRequests = useMemo(
    () => inviteRequests.filter((request) => isLandingEnrollmentSource(request.source)),
    [inviteRequests],
  );

  const pendingInviteRequests = useMemo(
    () =>
      landingInviteRequests.filter(
        (request) => String(request.status || "").toLowerCase() === "pending",
      ),
    [landingInviteRequests],
  );

  const approvedInviteRequests = useMemo(
    () =>
      landingInviteRequests.filter(
        (request) => String(request.status || "").toLowerCase() === "approved",
      ),
    [landingInviteRequests],
  );

  const activeCourse = useMemo(() => {
    const fromParam = courseId ? getCourse(courseId) : null;
    if (fromParam) return fromParam;

    if (selectedCourseId !== "all") {
      const fromSelected = courseItems.find(
        (course) => String(course.id) === String(selectedCourseId),
      );
      if (fromSelected) return fromSelected;
    }

    return state.currentCourse || courseItems[0] || null;
  }, [courseId, courseItems, getCourse, selectedCourseId, state.currentCourse]);

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

  const enrollmentStudents = useMemo(
    () => buildStudentsFromEnrollments(academyEnrollments, courseItems),
    [academyEnrollments, courseItems],
  );

  const approvedInviteStudents = useMemo(() => {
    const fallbackCourseId =
      selectedCourseId !== "all"
        ? String(selectedCourseId)
        : String(activeCourse?.id || courseItems[0]?.id || "academy-landing");
    const fallbackCourseTitle =
      courseItems.find((course) => String(course.id) === fallbackCourseId)?.title ||
      activeCourse?.title ||
      tt("Landingpåmelding", "Landing Enrollment");

    return approvedInviteRequests.map((request, index) => {
      const planLabel =
        request.planName ||
        request.selectedPlan ||
        tt("Abonnement ikke valgt", "No subscription selected");

      return {
        id: `landing-approved-${request.id}`,
        name: displayNameFromInviteRequest(request, index),
        email: request.email,
        role:
          request.profession && String(request.profession).trim().length > 0
            ? navLabel(request.profession)
            : tt("Deltaker", "Learner"),
        primaryCohort: fallbackCourseTitle,
        primaryCourseId: fallbackCourseId,
        courseIds: [fallbackCourseId],
        sourceCount: 1,
        completionRate: 0,
        enrolledScore: 0,
        tags: [tt("Landing", "Landing"), planLabel],
        avatarTheme: index % placeholderBackgrounds.length,
        enrolledAt:
          request.processedDate ||
          request.requestDate ||
          new Date().toISOString(),
        subscriptionPlanId: request.selectedPlan || undefined,
        subscriptionPlanName: request.planName || request.selectedPlan || undefined,
        subscriptionPlanPrice:
          typeof request.planPrice === "number" ? request.planPrice : undefined,
        inviteRequestId: request.id,
      } as StudentEnrollmentItem;
    });
  }, [
    activeCourse?.id,
    activeCourse?.title,
    approvedInviteRequests,
    courseItems,
    navLabel,
    selectedCourseId,
    tt,
  ]);

  const baseStudents = useMemo(() => {
    const merged = [...approvedInviteStudents, ...enrollmentStudents, ...manualStudents];
    const seen = new Set<string>();
    return merged
      .filter((student) => {
        if (seen.has(student.id)) return false;
        seen.add(student.id);
        return !hiddenStudentIds.includes(student.id);
      })
      .map((student) => {
        const override = studentOverrides[student.id];
        if (!override) return student;
        return {
          ...student,
          ...override,
          tags: Array.isArray(override.tags) ? override.tags : student.tags,
          courseIds:
            Array.isArray(override.courseIds) && override.courseIds.length > 0
              ? override.courseIds
              : student.courseIds,
          subscriptionPlanId:
            typeof override.subscriptionPlanId === "string"
              ? override.subscriptionPlanId
              : student.subscriptionPlanId,
          subscriptionPlanName:
            typeof override.subscriptionPlanName === "string"
              ? override.subscriptionPlanName
              : student.subscriptionPlanName,
          subscriptionPlanPrice:
            typeof override.subscriptionPlanPrice === "number"
              ? override.subscriptionPlanPrice
              : student.subscriptionPlanPrice,
        };
      });
  }, [
    approvedInviteStudents,
    enrollmentStudents,
    hiddenStudentIds,
    manualStudents,
    studentOverrides,
  ]);

  useEffect(() => {
    analytics.trackEvent("academy_enrollment_studio_opened", {
      courseId: activeCourse?.id || null,
      studentCount: baseStudents.length,
      enrollmentCount: academyEnrollments.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration("info", "AcademyEnrollmentStudio opened", {
      courseId: activeCourse?.id || null,
      studentCount: baseStudents.length,
      enrollmentCount: academyEnrollments.length,
    });
  }, [
    academyEnrollments.length,
    activeCourse?.id,
    analytics,
    baseStudents.length,
    debugging,
  ]);

  const visibleStudents = useMemo(() => {
    const now = Date.now();
    const rangeDays =
      rangeFilter === "7d" ? 7 : rangeFilter === "30d" ? 30 : 90;
    const since = now - rangeDays * 24 * 60 * 60 * 1000;
    const query = searchValue.trim().toLowerCase();

    return baseStudents.filter((student) => {
      const enrolledAtTime = new Date(student.enrolledAt).getTime();
      const inRange = Number.isNaN(enrolledAtTime)
        ? true
        : enrolledAtTime >= since;
      if (!inRange) return false;

      const matchesCourse =
        selectedCourseId === "all"
          ? true
          : student.courseIds.some(
              (id) => String(id) === String(selectedCourseId),
            );
      if (!matchesCourse) return false;

      const matchesCompletion =
        completionFilter === "all"
          ? true
          : completionFilter === "high"
            ? student.completionRate >= 85
            : completionFilter === "mid"
              ? student.completionRate >= 65 && student.completionRate < 85
              : student.completionRate < 65;
      if (!matchesCompletion) return false;

      if (!query) return true;
      return (
        student.name.toLowerCase().includes(query) ||
        student.role.toLowerCase().includes(query) ||
        student.primaryCohort.toLowerCase().includes(query) ||
        student.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [
    baseStudents,
    completionFilter,
    rangeFilter,
    searchValue,
    selectedCourseId,
  ]);

  const totals = useMemo(() => {
    const totalStudents = baseStudents.length;
    const avgCompletion =
      totalStudents === 0
        ? 0
        : Math.round(
            baseStudents.reduce(
              (sum, student) => sum + student.completionRate,
              0,
            ) / totalStudents,
          );
    const enrolledTotal = baseStudents.reduce(
      (sum, student) => sum + student.enrolledScore,
      0,
    );
    const avgEnrollScore =
      totalStudents === 0 ? 0 : Math.round(enrolledTotal / totalStudents);
    const activeCount = baseStudents.filter(
      (student) => student.completionRate >= 75,
    ).length;

    return {
      totalStudents,
      avgCompletion,
      avgEnrollScore,
      activeCount,
    };
  }, [baseStudents]);

  const distribution = useMemo(() => {
    const excellent = baseStudents.filter(
      (student) => student.completionRate >= 90,
    ).length;
    const healthy = baseStudents.filter(
      (student) => student.completionRate >= 75 && student.completionRate < 90,
    ).length;
    const improving = baseStudents.filter(
      (student) => student.completionRate >= 60 && student.completionRate < 75,
    ).length;
    const atRisk = baseStudents.filter(
      (student) => student.completionRate < 60,
    ).length;

    const total = Math.max(1, excellent + healthy + improving + atRisk);

    return {
      excellent,
      healthy,
      improving,
      atRisk,
      excellentPct: Math.round((excellent / total) * 100),
      healthyPct: Math.round((healthy / total) * 100),
      improvingPct: Math.round((improving / total) * 100),
      atRiskPct: Math.round((atRisk / total) * 100),
    };
  }, [baseStudents]);

  const donutStyle = useMemo(() => {
    const excellentDeg = distribution.excellentPct * 3.6;
    const healthyDeg = distribution.healthyPct * 3.6;
    const improvingDeg = distribution.improvingPct * 3.6;
    const atRiskDeg = distribution.atRiskPct * 3.6;

    return `conic-gradient(#f8b321 0deg ${excellentDeg}deg, #8ea6d6 ${excellentDeg}deg ${excellentDeg + healthyDeg}deg, #9acd6f ${excellentDeg + healthyDeg}deg ${excellentDeg + healthyDeg + improvingDeg}deg, #c56f58 ${excellentDeg + healthyDeg + improvingDeg}deg ${excellentDeg + healthyDeg + improvingDeg + atRiskDeg}deg, rgba(255,255,255,0.1) ${excellentDeg + healthyDeg + improvingDeg + atRiskDeg}deg 360deg)`;
  }, [
    distribution.excellentPct,
    distribution.healthyPct,
    distribution.improvingPct,
    distribution.atRiskPct,
  ]);

  const topCohorts = useMemo(() => {
    const grouped = new Map<
      string,
      { students: number; completionTotal: number }
    >();

    baseStudents.forEach((student) => {
      const entry = grouped.get(student.primaryCohort) || {
        students: 0,
        completionTotal: 0,
      };
      entry.students += 1;
      entry.completionTotal += student.completionRate;
      grouped.set(student.primaryCohort, entry);
    });

    const items: TopCohortItem[] = Array.from(grouped.entries()).map(
      ([name, values], index) => ({
        id: `cohort-insight-${index}`,
        name,
        students: values.students,
        avgCompletion: Math.round(
          values.completionTotal / Math.max(values.students, 1),
        ),
        imageTheme: index % placeholderBackgrounds.length,
      }),
    );

    return items.sort((a, b) => b.students - a.students).slice(0, 3);
  }, [baseStudents]);

  const handleExport = useCallback(async () => {
    if (visibleStudents.length === 0) {
      setSaveMessage(
        tt("Ingen studentdata å eksportere.", "No student data to export."),
      );
      return;
    }

    const courseLabel =
      selectedCourseId === "all"
        ? tt("Alle kompetanser", "All competencies")
        : String(
            courseItems.find(
              (course) => String(course.id) === String(selectedCourseId),
            )?.title || selectedCourseId,
          );

    await academyPdfExportService.exportReport({
      fileName: `academy-enrollment-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: tt("Studentpåmelding", "Student Enrollment"),
      subtitle: tt(
        "Påmeldingsstatus, aktivitet og fremdrift",
        "Enrollment status, activity, and progress",
      ),
      courseLabel,
      locale: language === "no" ? "nb-NO" : "en-US",
      sections: [
        {
          title: tt("Oversikt", "Overview"),
          metrics: [
            {
              label: tt("Totale studenter", "Total students"),
              value: totals.totalStudents,
            },
            {
              label: tt("Aktive studenter", "Active students"),
              value: totals.activeCount,
            },
            {
              label: tt("Gj.sn. fullføring", "Avg completion"),
              value: `${totals.avgCompletion}%`,
            },
            {
              label: tt("Gj.sn. score", "Avg score"),
              value: totals.avgEnrollScore,
            },
          ],
        },
        {
          title: tt("Fullføringsfordeling", "Completion Distribution"),
          table: {
            columns: [
              tt("Kategori", "Category"),
              tt("Antall", "Count"),
              tt("Andel", "Share"),
            ],
            rows: [
              [
                tt("Utmerket", "Excellent"),
                distribution.excellent,
                `${distribution.excellentPct}%`,
              ],
              [
                tt("Sunn fremdrift", "Healthy"),
                distribution.healthy,
                `${distribution.healthyPct}%`,
              ],
              [
                tt("Forbedrer seg", "Improving"),
                distribution.improving,
                `${distribution.improvingPct}%`,
              ],
              [
                tt("Risiko", "At Risk"),
                distribution.atRisk,
                `${distribution.atRiskPct}%`,
              ],
            ],
          },
        },
        {
          title: tt("Studentliste", "Student List"),
          table: {
            columns: [
              tt("Navn", "Name"),
              tt("Rolle", "Role"),
              tt("Kohort", "Cohort"),
              tt("Fullføring", "Completion"),
              tt("Score", "Score"),
              tt("Tagger", "Tags"),
            ],
            rows: visibleStudents.map((student) => [
              student.name,
              student.role,
              student.primaryCohort,
              `${student.completionRate}%`,
              student.enrolledScore,
              student.tags.join(", ") || "-",
            ]),
          },
        },
        {
          title: tt("Toppkohorter", "Top Cohorts"),
          table: {
            columns: [
              tt("Kohort", "Cohort"),
              tt("Studenter", "Students"),
              tt("Gj.sn. fullføring", "Avg completion"),
            ],
            rows: topCohorts.map((cohort) => [
              cohort.name,
              cohort.students,
              `${cohort.avgCompletion}%`,
            ]),
          },
        },
      ],
    });

    analytics.trackEvent("academy_enrollment_export_clicked", {
      courseId: selectedCourseId,
      visibleStudents: visibleStudents.length,
      timestamp: Date.now(),
    });
    setSaveMessage(
      tt(
        "Påmeldingsrapport eksportert som PDF.",
        "Enrollment report exported as PDF.",
      ),
    );
  }, [
    analytics,
    courseItems,
    distribution.atRisk,
    distribution.atRiskPct,
    distribution.excellent,
    distribution.excellentPct,
    distribution.healthy,
    distribution.healthyPct,
    distribution.improving,
    distribution.improvingPct,
    language,
    selectedCourseId,
    topCohorts,
    totals.activeCount,
    totals.avgCompletion,
    totals.avgEnrollScore,
    totals.totalStudents,
    tt,
    visibleStudents,
  ]);

  const handleReports = useCallback(async () => {
    analytics.trackEvent("academy_enrollment_reports_clicked", {
      courseId: selectedCourseId,
      visibleStudents: visibleStudents.length,
      timestamp: Date.now(),
    });
    await handleExport();
  }, [analytics, handleExport, selectedCourseId, visibleStudents.length]);

  const enrollmentCards = useMemo(() => {
    return courseItems.slice(0, 2).map((course, index) => {
      const forCourse = baseStudents.filter((student) =>
        student.courseIds.some((id) => String(id) === String(course.id)),
      );
      const avgCompletion =
        forCourse.length === 0
          ? 0
          : Math.round(
              forCourse.reduce(
                (sum, student) => sum + student.completionRate,
                0,
              ) / forCourse.length,
            );

      return {
        id: String(course.id),
        title: course.title,
        cohortCount: forCourse.length,
        avgCompletion,
        imageTheme: index % placeholderBackgrounds.length,
        sources: Math.max(
          0,
          forCourse.reduce((sum, student) => sum + student.sourceCount, 0),
        ),
      };
    });
  }, [baseStudents, courseItems]);

  const openAddStudentModal = useCallback(() => {
    const preferredCourseId =
      selectedCourseId !== "all"
        ? selectedCourseId
        : String(activeCourse?.id || courseItems[0]?.id || "");

    setEditingStudentId(null);
    setAddStudentForm({
      name: "",
      email: "",
      role: tt("Deltaker", "Learner"),
      courseId: preferredCourseId,
      tags: "",
      subscriptionPlanId: "",
    });
    setIsAddStudentModalOpen(true);
  }, [activeCourse?.id, courseItems, selectedCourseId, tt]);

  const openEditStudentModal = useCallback(
    (student: StudentEnrollmentItem) => {
      const courseId =
        student.primaryCourseId ||
        student.courseIds[0] ||
        String(activeCourse?.id || courseItems[0]?.id || "");
      setEditingStudentId(student.id);
      setAddStudentForm({
        name: student.name,
        email: student.email || "",
        role: student.role,
        courseId,
        tags: student.tags.join(", "),
        subscriptionPlanId: student.subscriptionPlanId || "",
      });
      setIsAddStudentModalOpen(true);
    },
    [activeCourse?.id, courseItems],
  );

  const closeStudentModal = useCallback(() => {
    setIsAddStudentModalOpen(false);
    setEditingStudentId(null);
  }, []);

  const handleMessageStudent = useCallback(
    (student: StudentEnrollmentItem) => {
      const recipient = (student.email || "").trim();
      if (!recipient || !recipient.includes("@")) {
        setSaveMessage(
          tt(
            "Denne studenten har ingen registrert e-post ennå.",
            "This student has no email registered yet.",
          ),
        );
        return;
      }

      const subject = encodeURIComponent(
        `${tt("Oppfølging", "Follow-up")}: ${student.name}`,
      );
      window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${subject}`;
    },
    [tt],
  );

  const handleRemoveStudent = useCallback(
    (student: StudentEnrollmentItem) => {
      if (student.isManual) {
        setManualStudents((prev) => prev.filter((item) => item.id !== student.id));
      } else {
        setHiddenStudentIds((prev) =>
          prev.includes(student.id) ? prev : [...prev, student.id],
        );
      }
      setSaveMessage(
        tt("Student fjernet fra visning.", "Student removed from view."),
      );
    },
    [tt],
  );

  const handleManageCourseCard = useCallback(
    (courseCardId: string) => {
      setSelectedCourseId(courseCardId);
      setSearchValue("");
      const matchingCourse = courseItems.find(
        (course) => String(course.id) === String(courseCardId),
      );
      setSaveMessage(
        tt("Filter satt til", "Filter set to") +
          `: ${matchingCourse?.title || courseCardId}`,
      );
    },
    [courseItems, tt],
  );

  const handleOpenCourseBuilder = useCallback(
    (courseCardId: string) => {
      setLocation(`/academy/course-creator?courseId=${encodeURIComponent(courseCardId)}`);
    },
    [setLocation],
  );

  const submitAddStudent = useCallback(() => {
    const name = addStudentForm.name.trim();
    if (!name) {
      setSaveMessage(
        tt("Fyll ut studentnavn før du lagrer.", "Fill in student name."),
      );
      return;
    }

    const tags = parseTagList(addStudentForm.tags);
    const normalizedEmail = addStudentForm.email.trim();
    const resolvedRole = addStudentForm.role.trim() || tt("Deltaker", "Learner");
    const selectedPlan = subscriptionPlanOptions.find(
      (plan) => plan.id === addStudentForm.subscriptionPlanId,
    );
    const selectedPlanName = selectedPlan
      ? language === "no"
        ? selectedPlan.labelNo
        : selectedPlan.labelEn
      : "";
    const fallbackCourseId = String(
      addStudentForm.courseId ||
        activeCourse?.id ||
        courseItems[0]?.id ||
        `manual-course-${Date.now()}`,
    );
    const targetCourse = courseItems.find(
      (course) => String(course.id) === String(fallbackCourseId),
    );
    const resolvedPrimaryCohort =
      targetCourse?.title || tt("Akademikohort", "Academy Cohort");

    if (editingStudentId) {
      setStudentOverrides((prev) => ({
        ...prev,
        [editingStudentId]: {
          name,
          email: normalizedEmail,
          role: resolvedRole,
          primaryCourseId: fallbackCourseId,
          primaryCohort: resolvedPrimaryCohort,
          courseIds: [fallbackCourseId],
          tags: tags.length > 0 ? tags : [tt("Oppdatert", "Updated")],
          subscriptionPlanId: selectedPlan?.id,
          subscriptionPlanName: selectedPlanName || undefined,
          subscriptionPlanPrice:
            typeof selectedPlan?.monthlyPriceNok === "number"
              ? selectedPlan.monthlyPriceNok
              : undefined,
        },
      }));
      setActivityFeed((prev) => [
        {
          id: `activity-edit-${editingStudentId}-${Date.now()}`,
          author: name,
          course: resolvedPrimaryCohort,
          action: "student updated",
          timestamp: tt("nå", "now"),
        },
        ...prev,
      ]);
      setSaveMessage(tt("Student oppdatert.", "Student updated."));
      closeStudentModal();
      return;
    }

    const index = baseStudents.length + 1;
    const now = new Date().toISOString();
    const idSeed = (normalizedEmail || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const newStudent: StudentEnrollmentItem = {
      id: `manual-student-${idSeed || Date.now()}-${Date.now()}`,
      name,
      email: normalizedEmail,
      role: resolvedRole,
      primaryCohort: resolvedPrimaryCohort,
      primaryCourseId: fallbackCourseId,
      courseIds: [fallbackCourseId],
      sourceCount: 1,
      completionRate: 0,
      enrolledScore: 0,
      tags: tags.length > 0 ? tags : [tt("Ny", "New")],
      avatarTheme: index % placeholderBackgrounds.length,
      enrolledAt: now,
      subscriptionPlanId: selectedPlan?.id,
      subscriptionPlanName: selectedPlanName || undefined,
      subscriptionPlanPrice:
        typeof selectedPlan?.monthlyPriceNok === "number"
          ? selectedPlan.monthlyPriceNok
          : undefined,
      isManual: true,
    };

    setManualStudents((prev) => [newStudent, ...prev]);
    setActivityFeed((prev) => [
      {
        id: `activity-${Date.now()}`,
        author: newStudent.name,
        course: newStudent.primaryCohort,
        action: "added to enrollment",
        timestamp: tt("nå", "now"),
      },
      ...prev,
    ]);
    setSaveMessage(tt("Student lagt til.", "Student added."));
    analytics.trackEvent("academy_enrollment_student_added", {
      courseId: fallbackCourseId,
      studentName: newStudent.name,
      timestamp: Date.now(),
    });
    closeStudentModal();
  }, [
    closeStudentModal,
    activeCourse?.id,
    addStudentForm.courseId,
    addStudentForm.email,
    addStudentForm.name,
    addStudentForm.role,
    addStudentForm.subscriptionPlanId,
    addStudentForm.tags,
    analytics,
    baseStudents.length,
    courseItems,
    editingStudentId,
    language,
    subscriptionPlanOptions,
    tt,
  ]);

  const processInviteRequestMutation = useMutation({
    mutationFn: async ({
      requestId,
      status,
    }: {
      requestId: string;
      status: "approved" | "rejected";
    }) =>
      apiRequest(`/api/invite-requests/${requestId}/process`, {
        method: "POST",
        body: {
          status,
        },
      }),
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["academy-enrollment-invite-requests"],
      });
      analytics.trackEvent("academy_enrollment_request_processed", {
        requestId: variables.requestId,
        status: variables.status,
        timestamp: Date.now(),
      });
      setSaveMessage(
        variables.status === "approved"
          ? tt(
              "Studentforespørsel godkjent og tilgang aktivert.",
              "Enrollment request approved and access granted.",
            )
          : tt(
              "Studentforespørsel avvist.",
              "Enrollment request rejected.",
            ),
      );
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : tt(
              "Kunne ikke oppdatere forespørsel.",
              "Failed to process enrollment request.",
            );
      setSaveMessage(message);
    },
  });

  const handleProcessInviteRequest = useCallback(
    async (request: InviteRequestItem, status: "approved" | "rejected") => {
      setProcessingInviteRequestId(request.id);
      try {
        await processInviteRequestMutation.mutateAsync({
          requestId: request.id,
          status,
        });

        const planLabel =
          request.planName ||
          request.selectedPlan ||
          tt("Uten abonnement", "No subscription");
        setActivityFeed((prev) => [
          {
            id: `invite-request-${request.id}-${Date.now()}`,
            author: displayNameFromInviteRequest(request, 0),
            course: planLabel,
            action:
              status === "approved"
                ? "access approved"
                : "access rejected",
            timestamp: tt("nå", "now"),
          },
          ...prev,
        ]);
      } catch (error) {
        debugging.logIntegration(
          "error",
          "Failed to process academy enrollment invite request",
          {
            requestId: request.id,
            status,
            message: error instanceof Error ? error.message : String(error),
          },
        );
      } finally {
        setProcessingInviteRequestId(null);
      }
    },
    [debugging, processInviteRequestMutation, tt],
  );

  const toggleFeatureFlag = useCallback((key: keyof typeof featureFlags) => {
    setFeatureFlags((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const saveEnrollmentSettings = useCallback(
    async (publish: boolean) => {
      const payload = {
        courseId: activeCourse?.id || null,
        selectedCourseId,
        rangeFilter,
        completionFilter,
        flags: featureFlags,
        students: baseStudents,
        analytics: {
          totalStudents: totals.totalStudents,
          avgCompletion: totals.avgCompletion,
          avgEnrollScore: totals.avgEnrollScore,
        },
        publish,
        updatedAt: new Date().toISOString(),
      };

      try {
        if (
          activeCourse?.id &&
          Array.isArray(state?.courses) &&
          state.courses.some(
            (course) => String(course.id) === String(activeCourse.id),
          )
        ) {
          const nextTags = Array.from(
            new Set([...(activeCourse.tags || []), "enrollment"]),
          );
          await updateCourse({
            ...activeCourse,
            tags: nextTags,
            isPublished: publish ? true : activeCourse.isPublished,
            updatedAt: new Date().toISOString(),
          });
        }

        setSaveMessage(
          publish
            ? tt(
                "Påmeldingsoppdateringer publisert.",
                "Enrollment updates published.",
              )
            : tt(
                "Påmeldingsoppdateringer lagret.",
                "Enrollment updates saved.",
              ),
        );
        onSave?.(payload);

        analytics.trackEvent(
          publish ? "academy_enrollment_publish" : "academy_enrollment_save",
          {
            courseId: activeCourse?.id || null,
            studentCount: totals.totalStudents,
            publish,
            timestamp: Date.now(),
          },
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tt(
                "Kunne ikke lagre påmeldingsinnstillinger.",
                "Failed to save enrollment settings.",
              );
        setSaveMessage(message);
        debugging.logIntegration("error", "Academy enrollment save failed", {
          courseId: activeCourse?.id || null,
          message,
        });
      }
    },
    [
      activeCourse,
      analytics,
      baseStudents,
      completionFilter,
      debugging,
      featureFlags,
      onSave,
      rangeFilter,
      selectedCourseId,
      state?.courses,
      tt,
      totals.avgCompletion,
      totals.avgEnrollScore,
      totals.totalStudents,
      updateCourse,
    ],
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
          bottomAction={{
            label: tt("Legg til student", "Add Student"),
            onClick: openAddStudentModal,
          }}
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
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography
                sx={{
                  letterSpacing: "0.22em",
                  fontSize: 15,
                  color: "rgba(237,240,247,0.82)",
                }}
              >
                CREATOR STUDIO
              </Typography>
              <Chip
                label={
                  activeCourse?.isPublished
                    ? tt("Publisert", "Published")
                    : tt("Utkast", "Draft")
                }
                size="small"
                sx={{
                  bgcolor: "rgba(255,255,255,0.08)",
                  color: "#edf0f7",
                  fontWeight: 600,
                }}
              />
            </Stack>

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
                  {String(activeCourse?.instructor?.name || "N")
                    .charAt(0)
                    .toUpperCase()}
                </Avatar>
              </IconButton>
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 390px" },
              gap: 2,
              px: 2,
              py: 2,
            }}
          >
            <Box
              sx={{
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: 1.4,
              }}
            >
              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", lg: "center" }}
              >
                <Typography
                  sx={{
                    fontSize: 26,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                  }}
                >
                  {tt("Studentpåmelding", "Student Enrollment")}
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
                      borderRadius: 1,
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
                      borderRadius: 1,
                    }}
                  >
                    {tt("Rapporter", "Reports")}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={openAddStudentModal}
                    sx={{
                      textTransform: "none",
                      borderRadius: 1,
                      color: "#0f0f0f",
                      background: "linear-gradient(180deg, #ffd44e, #f2a616)",
                      boxShadow: "0 10px 24px rgba(248,179,33,0.25)",
                    }}
                  >
                    {tt("Legg til student", "Add Student")}
                  </Button>
                </Stack>
              </Stack>

              {!!saveMessage && (
                <Typography
                  sx={{
                    px: 1.2,
                    py: 0.85,
                    borderRadius: 1,
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.34)",
                    color: "#f8d56f",
                    bgcolor: "rgba(248,179,33,0.08)",
                  }}
                >
                  {saveMessage}
                </Typography>
              )}

              {(inviteRequestsLoading || pendingInviteRequests.length > 0) && (
                <Box sx={{ ...panelSx, p: 1.1 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    sx={{ mb: 0.9 }}
                  >
                    <Typography sx={{ fontSize: 18, fontWeight: 600 }}>
                      {tt(
                        "Påmeldingsforespørsler fra landingsside",
                        "Enrollment requests from landing",
                      )}
                    </Typography>
                    <Chip
                      label={inviteRequestsLoading
                        ? tt("Laster...", "Loading...")
                        : `${pendingInviteRequests.length} ${tt("venter", "pending")}`}
                      size="small"
                      sx={{
                        color: "#edf0f7",
                        bgcolor: "rgba(255,255,255,0.08)",
                      }}
                    />
                  </Stack>

                  <Stack spacing={0.8}>
                    {inviteRequestsLoading ? (
                      <Typography
                        sx={{
                          color: "rgba(237,240,247,0.68)",
                          fontSize: 13,
                        }}
                      >
                        {tt(
                          "Henter påmeldingsforespørsler...",
                          "Fetching enrollment requests...",
                        )}
                      </Typography>
                    ) : (
                      pendingInviteRequests
                        .slice(0, 8)
                        .map((request, requestIndex) => {
                          const requesterName = displayNameFromInviteRequest(
                            request,
                            requestIndex,
                          );
                          const planLabel =
                            request.planName ||
                            request.selectedPlan ||
                            tt("Uten abonnement", "No subscription");
                          const planPrice =
                            typeof request.planPrice === "number"
                              ? toNok(request.planPrice)
                              : null;
                          const isProcessing =
                            processingInviteRequestId === request.id;
                          const requestDateLabel = request.requestDate
                            ? new Date(request.requestDate).toLocaleString(
                                language === "no" ? "nb-NO" : "en-US",
                                { dateStyle: "medium", timeStyle: "short" },
                              )
                            : tt("Ukjent dato", "Unknown date");

                          return (
                            <Box
                              key={request.id}
                              sx={{
                                px: 1,
                                py: 0.9,
                                borderRadius: 1,
                                border:
                                  "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                                bgcolor: "rgba(10,14,22,0.7)",
                              }}
                            >
                              <Stack
                                direction={{ xs: "column", md: "row" }}
                                spacing={1}
                                justifyContent="space-between"
                                alignItems={{ xs: "flex-start", md: "center" }}
                              >
                                <Box>
                                  <Typography sx={{ fontWeight: 700 }}>
                                    {requesterName}
                                  </Typography>
                                  <Typography
                                    sx={{
                                      color: "rgba(237,240,247,0.7)",
                                      fontSize: 12.5,
                                    }}
                                  >
                                    {request.email} ·{" "}
                                    {request.profession
                                      ? navLabel(request.profession)
                                      : tt("Deltaker", "Learner")}
                                  </Typography>
                                  <Typography
                                    sx={{
                                      color: "rgba(237,240,247,0.58)",
                                      fontSize: 12,
                                    }}
                                  >
                                    {(request.business || tt("Firma ikke oppgitt", "No company provided"))}
                                    {" · "}
                                    {tt("Sendt", "Submitted")}: {requestDateLabel}
                                  </Typography>
                                  <Stack
                                    direction="row"
                                    spacing={0.8}
                                    flexWrap="wrap"
                                    useFlexGap
                                    sx={{ mt: 0.6 }}
                                  >
                                    <Chip
                                      size="small"
                                      label={planLabel}
                                      sx={{
                                        color: "#edf0f7",
                                        bgcolor: "rgba(248,179,33,0.18)",
                                      }}
                                    />
                                    {planPrice && (
                                      <Chip
                                        size="small"
                                        label={planPrice}
                                        sx={{
                                          color: "#edf0f7",
                                          bgcolor: "rgba(142,166,214,0.2)",
                                        }}
                                      />
                                    )}
                                  </Stack>
                                </Box>

                                <Stack direction="row" spacing={0.8}>
                                  <Button
                                    size="small"
                                    disabled={isProcessing}
                                    onClick={() =>
                                      void handleProcessInviteRequest(
                                        request,
                                        "rejected",
                                      )
                                    }
                                    sx={{
                                      minWidth: 84,
                                      textTransform: "none",
                                      color: "#edf0f7",
                                      border:
                                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                                    }}
                                  >
                                    {tt("Avvis", "Reject")}
                                  </Button>
                                  <Button
                                    size="small"
                                    disabled={isProcessing}
                                    onClick={() =>
                                      void handleProcessInviteRequest(
                                        request,
                                        "approved",
                                      )
                                    }
                                    sx={{
                                      minWidth: 108,
                                      textTransform: "none",
                                      color: "#0f0f0f",
                                      fontWeight: 700,
                                      background:
                                        "linear-gradient(180deg, #ffd44e, #f2a616)",
                                    }}
                                  >
                                    {isProcessing
                                      ? tt("Behandler...", "Processing...")
                                      : tt("Godkjenn tilgang", "Approve access")}
                                  </Button>
                                </Stack>
                              </Stack>
                            </Box>
                          );
                        })
                    )}
                  </Stack>
                </Box>
              )}

              <Box sx={{ ...panelSx, p: 1.2 }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", md: "center" }}
                  sx={{ mb: 1, flexWrap: "wrap", rowGap: 1 }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ minWidth: 0 }}
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
                        minWidth: { xs: 150, sm: 180 },
                        color: "#edf0f7",
                        bgcolor: "rgba(255,255,255,0.05)",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255,255,255,0.16)",
                        },
                      }}
                    >
                      <MenuItem value="all">
                        {tt("Alle kompetanser", "All competencies")}
                      </MenuItem>
                      {courseItems.map((course) => (
                        <MenuItem key={course.id} value={course.id}>
                          {course.title}
                        </MenuItem>
                      ))}
                    </Select>

                    <Select
                      size="small"
                      value={rangeFilter}
                      onChange={(event) =>
                        setRangeFilter(event.target.value as RangeFilter)
                      }
                      sx={{
                        minWidth: { xs: 130, sm: 140 },
                        color: "#edf0f7",
                        bgcolor: "rgba(255,255,255,0.05)",
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

                    <Select
                      size="small"
                      value={completionFilter}
                      onChange={(event) =>
                        setCompletionFilter(
                          event.target.value as CompletionFilter,
                        )
                      }
                      sx={{
                        minWidth: { xs: 140, sm: 150 },
                        color: "#edf0f7",
                        bgcolor: "rgba(255,255,255,0.05)",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255,255,255,0.16)",
                        },
                      }}
                    >
                      <MenuItem value="all">
                        {tt("Alle fullføringsnivåer", "All Completion")}
                      </MenuItem>
                      <MenuItem value="high">
                        {tt("Høy (85%+)", "High (85%+)")}
                      </MenuItem>
                      <MenuItem value="mid">
                        {tt("Middels (65-84%)", "Mid (65-84%)")}
                      </MenuItem>
                      <MenuItem value="low">
                        {tt("Lav (<65%)", "Low (<65%)")}
                      </MenuItem>
                    </Select>
                  </Stack>
                </Stack>

                <TextField
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={tt("Søk studenter...", "Search students...")}
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <Search
                        fontSize="small"
                        sx={{ mr: 0.7, color: "rgba(237,240,247,0.6)" }}
                      />
                    ),
                  }}
                  sx={{
                    width: "100%",
                    "& .MuiInputBase-root": {
                      bgcolor: "rgba(11,14,22,0.8)",
                      color: "#edf0f7",
                    },
                  }}
                />

                <Box
                  sx={{
                    mt: 1.1,
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                      lg: "repeat(4, minmax(0, 1fr))",
                    },
                    gap: 1,
                  }}
                >
                  <Box
                    sx={{
                      ...panelSx,
                      p: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <Typography
                      sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}
                    >
                      {toCompactNumber(totals.totalStudents)}
                    </Typography>
                    <Typography sx={{ color: "rgba(237,240,247,0.8)" }}>
                      {tt("Studenter", "Students")}
                    </Typography>
                    <Typography
                      sx={{ fontSize: 12, color: "rgba(237,240,247,0.64)" }}
                    >
                      {tt("Side 1 av", "Page 1 of")}{" "}
                      {Math.max(
                        1,
                        Math.ceil(Math.max(totals.totalStudents, 1) / 50),
                      )}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      ...panelSx,
                      p: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <Typography
                      sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}
                    >
                      {totals.activeCount}
                    </Typography>
                    <Typography sx={{ color: "rgba(237,240,247,0.8)" }}>
                      {tt("Aktive deltakere", "Active Learners")}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "#95d57e" }}>
                      {tt("Fullføring ≥ 75%", "Completion ≥ 75%")}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      ...panelSx,
                      p: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <Typography
                      sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}
                    >
                      {totals.avgCompletion}%
                    </Typography>
                    <Typography sx={{ color: "rgba(237,240,247,0.8)" }}>
                      {tt("Gj.sn. fullføring", "Avg Completion")}
                    </Typography>
                    <Typography
                      sx={{ fontSize: 12, color: "rgba(237,240,247,0.64)" }}
                    >
                      {tt("Alle kohorter", "All cohorts")}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      ...panelSx,
                      p: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <Typography
                      sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}
                    >
                      {totals.avgEnrollScore}
                    </Typography>
                    <Typography sx={{ color: "rgba(237,240,247,0.8)" }}>
                      {tt("Påmeldingsindeks", "Enrolled Index")}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "#95d57e" }}>
                      {tt("Operativ helse", "Operational health")}
                    </Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    mt: 1.1,
                    borderRadius: 1,
                    overflowX: "auto",
                    overflowY: "hidden",
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.09)",
                  }}
                >
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(260px, 1.5fr) minmax(220px, 1fr) 0.7fr 0.55fr 0.45fr",
                      minWidth: 980,
                      px: 1,
                      py: 0.8,
                      background: "rgba(255,255,255,0.04)",
                      borderBottom:
                        "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <Typography
                      sx={{ fontSize: 13, color: "rgba(237,240,247,0.7)" }}
                    >
                      Name
                    </Typography>
                    <Typography
                      sx={{ fontSize: 13, color: "rgba(237,240,247,0.7)" }}
                    >
                      Primary Cohort
                    </Typography>
                    <Typography
                      sx={{ fontSize: 13, color: "rgba(237,240,247,0.7)" }}
                    >
                      {tt("Fullføring", "Completion")}
                    </Typography>
                    <Typography
                      sx={{ fontSize: 13, color: "rgba(237,240,247,0.7)" }}
                    >
                      Enrolled
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 13,
                        color: "rgba(237,240,247,0.7)",
                        textAlign: "right",
                      }}
                    >
                      Actions
                    </Typography>
                  </Box>

                  <Stack spacing={0}>
                    {visibleStudents.map((student) => (
                      <Box
                        key={student.id}
                        sx={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(260px, 1.5fr) minmax(220px, 1fr) 0.7fr 0.55fr 0.45fr",
                          minWidth: 980,
                          px: 1,
                          py: 1,
                          gap: 1,
                          background: "rgba(8,11,18,0.6)",
                          borderBottom:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                          "&:hover": {
                            background:
                              "linear-gradient(90deg, rgba(248,179,33,0.12), rgba(255,255,255,0.02))",
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
                              width: 42,
                              height: 42,
                              border:
                                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
                              bgcolor: "rgba(248,179,33,0.32)",
                              backgroundImage:
                                placeholderBackgrounds[
                                  student.avatarTheme %
                                    placeholderBackgrounds.length
                                ],
                            }}
                          >
                            {student.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box minWidth={0}>
                            <Typography sx={{ fontWeight: 600 }} noWrap>
                              {student.name}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: 12,
                                color: "rgba(237,240,247,0.66)",
                              }}
                              noWrap
                            >
                              {student.role} · {student.courseIds.length}{" "}
                              {tt(
                                "kurs",
                                student.courseIds.length === 1
                                  ? "course"
                                  : "courses",
                              )}
                            </Typography>
                            <Stack
                              direction="row"
                              spacing={0.6}
                              sx={{ mt: 0.4 }}
                              flexWrap="wrap"
                              useFlexGap
                            >
                              {student.tags.slice(0, 2).map((tag) => (
                                <Chip
                                  key={`${student.id}-${tag}`}
                                  label={navLabel(tag)}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    color: "#edf0f7",
                                    bgcolor: "rgba(255,255,255,0.1)",
                                    fontSize: 11,
                                  }}
                                />
                              ))}
                            </Stack>
                          </Box>
                        </Stack>

                        <Box>
                          <Typography sx={{ fontWeight: 600 }} noWrap>
                            {student.primaryCohort}
                          </Typography>
                            <Typography
                              sx={{
                                fontSize: 12,
                                color: "rgba(237,240,247,0.64)",
                              }}
                            >
                              {student.sourceCount} sources
                            </Typography>
                            {student.subscriptionPlanName && (
                              <Typography
                                sx={{
                                  fontSize: 12,
                                  color: "rgba(237,240,247,0.64)",
                                }}
                              >
                                {tt("Abonnement", "Subscription")}:{" "}
                                {student.subscriptionPlanName}
                                {typeof student.subscriptionPlanPrice === "number"
                                  ? ` · ${toNok(student.subscriptionPlanPrice)}`
                                  : ""}
                              </Typography>
                            )}
                          </Box>

                        <Box>
                          <Typography
                            sx={{ color: "#95d57e", fontWeight: 700 }}
                          >
                            {student.completionRate}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(
                              100,
                              Math.max(0, student.completionRate),
                            )}
                            sx={{
                              mt: 0.4,
                              height: 5,
                              borderRadius: 999,
                              bgcolor: "rgba(255,255,255,0.14)",
                              "& .MuiLinearProgress-bar": {
                                borderRadius: 999,
                                background:
                                  "linear-gradient(90deg, #8ecf76 0%, #f8b321 100%)",
                              },
                            }}
                          />
                        </Box>

                        <Typography sx={{ color: "#f8d56f", fontWeight: 700 }}>
                          {student.enrolledScore}
                        </Typography>

                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="flex-end"
                        >
                          <IconButton
                            size="small"
                            onClick={() => handleMessageStudent(student)}
                            sx={{ color: "rgba(237,240,247,0.68)" }}
                          >
                            <MailOutline fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => openEditStudentModal(student)}
                            sx={{ color: "rgba(237,240,247,0.68)" }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveStudent(student)}
                            sx={{ color: "rgba(237,240,247,0.68)" }}
                          >
                            <MoreHoriz fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Box>
                    ))}

                    {visibleStudents.length === 0 && (
                      <Box
                        sx={{ px: 1.2, py: 2.5, bgcolor: "rgba(8,11,18,0.6)" }}
                      >
                        <Typography sx={{ color: "rgba(237,240,247,0.66)" }}>
                          {tt(
                            "Ingen studenter samsvarer med gjeldende filter.",
                            "No students match current filters.",
                          )}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>

                <Typography sx={{ mt: 1.3, fontSize: 26, fontWeight: 600 }}>
                  {tt("Studentpåmelding", "Student Enrollment")}
                </Typography>

                <Box
                  sx={{
                    mt: 1,
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(2, minmax(0, 1fr))",
                    },
                    gap: 1,
                  }}
                >
                  {enrollmentCards.map((card, index) => (
                    <Box
                      key={card.id}
                      sx={{
                        ...panelSx,
                        p: 1,
                        borderColor: "rgba(255,255,255,0.1)",
                      }}
                    >
                      <Stack direction="row" spacing={1}>
                        <Box
                          sx={{
                            width: 120,
                            height: 72,
                            borderRadius: 1,
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                            background:
                              placeholderBackgrounds[
                                (card.imageTheme + index) %
                                  placeholderBackgrounds.length
                              ],
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 600 }} noWrap>
                            {card.title}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: 12,
                              color: "rgba(237,240,247,0.64)",
                            }}
                            noWrap
                          >
                            {card.cohortCount} {tt("studenter", "students")} ·{" "}
                            {card.sources} {tt("kilder", "sources")}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: 12,
                              color: "rgba(237,240,247,0.64)",
                              mt: 0.4,
                            }}
                          >
                            {tt("Gj.sn. fullføring", "Avg completion")}{" "}
                            {card.avgCompletion}%
                          </Typography>
                          <Stack direction="row" spacing={0.8} sx={{ mt: 0.8 }}>
                            <Button
                              size="small"
                              onClick={() => handleManageCourseCard(card.id)}
                              sx={{
                                textTransform: "none",
                                color: "#edf0f7",
                                border:
                                  "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                              }}
                            >
                              {tt("Administrer", "Manage")}
                            </Button>
                            <Button
                              size="small"
                              onClick={() => handleOpenCourseBuilder(card.id)}
                              sx={{
                                textTransform: "none",
                                color: "#edf0f7",
                                border:
                                  "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                              }}
                            >
                              {tt("Mesterklasse", "Masterclass")}
                            </Button>
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  ))}
                </Box>

                <Typography sx={{ mt: 1, color: "rgba(237,240,247,0.66)" }}>
                  {toCompactNumber(totals.totalStudents)}{" "}
                  {tt("studenter", "students")} ·{" "}
                  {tt("gj.sn. score", "avg score")} {totals.avgEnrollScore}
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                ...panelSx,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box
                sx={{
                  p: 1.2,
                  borderBottom:
                    "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
                }}
              >
                <Typography sx={{ fontSize: 22, fontWeight: 600 }}>
                  {tt("Studentinnsikt", "Student Insights")}
                </Typography>

                <Stack
                  direction="row"
                  spacing={0.8}
                  sx={{ mt: 1 }}
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Chip
                    label={tt("Tidlig tilgang", "Early Access")}
                    onClick={() => toggleFeatureFlag("earlyAccess")}
                    color={featureFlags.earlyAccess ? "warning" : "default"}
                    sx={{ color: "#edf0f7" }}
                  />
                  <Chip
                    label={tt("Kun invitasjon", "Invitation Only")}
                    onClick={() => toggleFeatureFlag("invitationOnly")}
                    color={featureFlags.invitationOnly ? "warning" : "default"}
                    sx={{ color: "#edf0f7" }}
                  />
                  <Chip
                    label={tt("Lukket", "Closed")}
                    onClick={() => toggleFeatureFlag("closed")}
                    color={featureFlags.closed ? "warning" : "default"}
                    sx={{ color: "#edf0f7" }}
                  />
                  <Chip
                    label={tt("Dryppslipp", "Drip Release")}
                    onClick={() => toggleFeatureFlag("dripRelease")}
                    color={featureFlags.dripRelease ? "warning" : "default"}
                    sx={{ color: "#edf0f7" }}
                  />
                </Stack>
              </Box>

              <Box
                sx={{
                  p: 1.2,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 22, fontWeight: 600, mb: 0.8 }}>
                    {tt("Oversikt over innsendinger", "Submissions Overview")}
                  </Typography>

                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <Box
                      sx={{
                        width: 122,
                        height: 122,
                        borderRadius: "50%",
                        background: donutStyle,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Box
                        sx={{
                          width: 84,
                          height: 84,
                          borderRadius: "50%",
                          bgcolor: "#0f1420",
                          display: "grid",
                          placeItems: "center",
                          textAlign: "center",
                        }}
                      >
                        <Typography sx={{ fontSize: 20, fontWeight: 700 }}>
                          {totals.totalStudents}
                        </Typography>
                        <Typography
                          sx={{ fontSize: 11, color: "rgba(237,240,247,0.62)" }}
                        >
                          {tt("Studenter", "Students")}
                        </Typography>
                      </Box>
                    </Box>

                    <Stack spacing={0.5} sx={{ flex: 1 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: "rgba(237,240,247,0.72)" }}>
                          {tt("Fremragende", "Excellent")}
                        </Typography>
                        <Typography>{distribution.excellentPct}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={distribution.excellentPct}
                        sx={{
                          height: 6,
                          borderRadius: 999,
                          bgcolor: "rgba(255,255,255,0.1)",
                          "& .MuiLinearProgress-bar": { background: "#f8b321" },
                        }}
                      />

                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: "rgba(237,240,247,0.72)" }}>
                          {tt("God utvikling", "Healthy")}
                        </Typography>
                        <Typography>{distribution.healthyPct}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={distribution.healthyPct}
                        sx={{
                          height: 6,
                          borderRadius: 999,
                          bgcolor: "rgba(255,255,255,0.1)",
                          "& .MuiLinearProgress-bar": { background: "#8ea6d6" },
                        }}
                      />

                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: "rgba(237,240,247,0.72)" }}>
                          {tt("Forbedres", "Improving")}
                        </Typography>
                        <Typography>{distribution.improvingPct}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={distribution.improvingPct}
                        sx={{
                          height: 6,
                          borderRadius: 999,
                          bgcolor: "rgba(255,255,255,0.1)",
                          "& .MuiLinearProgress-bar": { background: "#9acd6f" },
                        }}
                      />

                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ color: "rgba(237,240,247,0.72)" }}>
                          {tt("I risikosonen", "At Risk")}
                        </Typography>
                        <Typography>{distribution.atRiskPct}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={distribution.atRiskPct}
                        sx={{
                          height: 6,
                          borderRadius: 999,
                          bgcolor: "rgba(255,255,255,0.1)",
                          "& .MuiLinearProgress-bar": { background: "#c56f58" },
                        }}
                      />
                    </Stack>
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 20, fontWeight: 600, mb: 0.8 }}>
                    {tt("Toppkohorter", "Top Cohorts")}
                  </Typography>
                  <Stack spacing={0.8}>
                    {topCohorts.map((cohort) => (
                      <Stack
                        key={cohort.id}
                        direction="row"
                        spacing={0.8}
                        alignItems="center"
                        sx={{
                          px: 0.8,
                          py: 0.8,
                          borderRadius: 1,
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                          bgcolor: "rgba(10,14,22,0.7)",
                        }}
                      >
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 1,
                            border:
                              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                            background:
                              placeholderBackgrounds[
                                cohort.imageTheme %
                                  placeholderBackgrounds.length
                              ],
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap sx={{ fontWeight: 600 }}>
                            {cohort.name}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: 12,
                              color: "rgba(237,240,247,0.64)",
                            }}
                            noWrap
                          >
                            {cohort.students} {tt("studenter", "students")}
                          </Typography>
                        </Box>
                        <Typography sx={{ color: "#f8d56f", fontWeight: 700 }}>
                          {cohort.avgCompletion}%
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ ...panelSx, p: 1 }}>
                  <Typography sx={{ fontSize: 20, fontWeight: 600, mb: 0.8 }}>
                    {tt("Aktivitetsfeed", "Activity Feed")}
                  </Typography>
                  <Stack spacing={0.8}>
                    {activityFeed.map((item, index) => (
                      <Stack
                        key={item.id}
                        direction="row"
                        spacing={0.8}
                        alignItems="flex-start"
                        sx={{
                          px: 0.8,
                          py: 0.8,
                          borderRadius: 1,
                          border:
                            "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.1)",
                          bgcolor:
                            index === 0
                              ? "rgba(248,179,33,0.08)"
                              : "rgba(10,14,22,0.7)",
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 30,
                            height: 30,
                            bgcolor: "rgba(248,179,33,0.78)",
                            color: "#111",
                          }}
                        >
                          {item.author.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700 }} noWrap>
                            {item.author}
                          </Typography>
                          <Typography sx={{ color: "rgba(237,240,247,0.72)" }}>
                            {navLabel(item.action)} · {item.course}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: 12,
                              color: "rgba(237,240,247,0.58)",
                            }}
                          >
                            {item.timestamp}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Box>

              <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  startIcon={<Save />}
                  onClick={() => void saveEnrollmentSettings(false)}
                  sx={{
                    flex: 1,
                    textTransform: "none",
                    color: "#edf0f7",
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                  }}
                >
                  {tt("Lagre", "Save")}
                </Button>
                <Button
                  startIcon={<Publish />}
                  onClick={() => void saveEnrollmentSettings(true)}
                  sx={{
                    minWidth: 118,
                    textTransform: "none",
                    color: "#0f0f0f",
                    background: "linear-gradient(180deg, #ffd44e, #f2a616)",
                    fontWeight: 700,
                  }}
                >
                  {tt("Publiser", "Publish")}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ p: 1.1, pt: 0 }}>
                <Button
                  onClick={() => setLocation("/academy/cohort-settings")}
                  sx={{
                    flex: 1,
                    textTransform: "none",
                    color: "#edf0f7",
                    border:
                      "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
                  }}
                >
                  {tt("Kohorter", "Cohorts")}
                </Button>
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                sx={{ p: 1.1, pt: 0 }}
                alignItems="center"
              >
                <Typography
                  sx={{ color: "rgba(237,240,247,0.62)", fontSize: 12 }}
                >
                  {tt("Inntektsprognose", "Revenue projection")}:{" "}
                  {toNok(totals.avgEnrollScore * totals.totalStudents)}
                </Typography>
                <Box sx={{ ml: "auto" }}>
                  <Switch
                    checked={featureFlags.dripRelease}
                    onChange={() => toggleFeatureFlag("dripRelease")}
                    size="small"
                  />
                </Box>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>

      <Dialog
        open={isAddStudentModalOpen}
        onClose={closeStudentModal}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 1.5,
            border: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)",
            background:
              "linear-gradient(145deg, rgba(20,24,36,0.95), rgba(11,14,22,0.98))",
            color: "#edf0f7",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingStudentId
            ? tt("Rediger student", "Edit student")
            : tt("Legg til student", "Add Student")}
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <Stack spacing={1}>
            <TextField
              size="small"
              label={tt("Studentnavn", "Student name")}
              value={addStudentForm.name}
              onChange={(event) =>
                setAddStudentForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              autoFocus
              fullWidth
              sx={{
                "& .MuiInputBase-root": {
                  color: "#edf0f7",
                  bgcolor: "rgba(255,255,255,0.03)",
                },
              }}
            />
            <TextField
              size="small"
              label={tt("E-post (valgfritt)", "Email (optional)")}
              value={addStudentForm.email}
              onChange={(event) =>
                setAddStudentForm((prev) => ({
                  ...prev,
                  email: event.target.value,
                }))
              }
              fullWidth
              sx={{
                "& .MuiInputBase-root": {
                  color: "#edf0f7",
                  bgcolor: "rgba(255,255,255,0.03)",
                },
              }}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                size="small"
                label={tt("Rolle", "Role")}
                value={addStudentForm.role}
                onChange={(event) =>
                  setAddStudentForm((prev) => ({
                    ...prev,
                    role: event.target.value,
                  }))
                }
                fullWidth
                sx={{
                  "& .MuiInputBase-root": {
                    color: "#edf0f7",
                    bgcolor: "rgba(255,255,255,0.03)",
                  },
                }}
              />
              <TextField
                size="small"
                select
                label={tt("Kompetanse", "Competency")}
                value={addStudentForm.courseId}
                onChange={(event) =>
                  setAddStudentForm((prev) => ({
                    ...prev,
                    courseId: String(event.target.value),
                  }))
                }
                fullWidth
                sx={{
                  "& .MuiInputBase-root": {
                    color: "#edf0f7",
                    bgcolor: "rgba(255,255,255,0.03)",
                  },
                }}
              >
                {courseItems.length > 0 ? (
                  courseItems.map((course) => (
                    <MenuItem key={String(course.id)} value={String(course.id)}>
                      {course.title}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem value="">
                    {tt("Ingen kompetanser tilgjengelig", "No competencies available")}
                  </MenuItem>
                )}
              </TextField>
            </Stack>
            <TextField
              size="small"
              label={tt("Tagger (kommaseparert)", "Tags (comma-separated)")}
              value={addStudentForm.tags}
              onChange={(event) =>
                setAddStudentForm((prev) => ({
                  ...prev,
                  tags: event.target.value,
                }))
              }
              fullWidth
              sx={{
                "& .MuiInputBase-root": {
                  color: "#edf0f7",
                  bgcolor: "rgba(255,255,255,0.03)",
                },
              }}
            />
            <TextField
              size="small"
              select
              label={tt("Abonnement", "Subscription")}
              value={addStudentForm.subscriptionPlanId}
              onChange={(event) =>
                setAddStudentForm((prev) => ({
                  ...prev,
                  subscriptionPlanId: String(event.target.value),
                }))
              }
              fullWidth
              sx={{
                "& .MuiInputBase-root": {
                  color: "#edf0f7",
                  bgcolor: "rgba(255,255,255,0.03)",
                },
              }}
            >
              <MenuItem value="">
                {tt("Ingen abonnement", "No subscription")}
              </MenuItem>
              {subscriptionPlanOptions.map((plan) => (
                <MenuItem key={plan.id} value={plan.id}>
                  {(language === "no" ? plan.labelNo : plan.labelEn) +
                    (typeof plan.monthlyPriceNok === "number"
                      ? ` · ${toNok(plan.monthlyPriceNok)}`
                      : "")}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button
            onClick={closeStudentModal}
            sx={{
              textTransform: "none",
              color: "rgba(237,240,247,0.78)",
              border: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)",
            }}
          >
            {tt("Avbryt", "Cancel")}
          </Button>
          <Button
            variant="contained"
            startIcon={editingStudentId ? <Edit /> : <Add />}
            onClick={submitAddStudent}
            sx={{
              textTransform: "none",
              color: "#0f0f0f",
              background: "linear-gradient(180deg, #ffd44e, #f2a616)",
              fontWeight: 700,
            }}
          >
            {editingStudentId
              ? tt("Lagre endringer", "Save changes")
              : tt("Legg til student", "Add Student")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default withUniversalIntegration(AcademyEnrollmentStudio, {
  componentId: "academy-enrollment-studio",
  componentName: "Academy Enrollment Studio",
  componentType: "manager",
  componentCategory: "academy",
  featureIds: [
    "enrollment",
    "student-management",
    "enrollment-analytics",
    "academy-cohorts",
  ],
});
