import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Add, ExpandLess, ExpandMore } from "@mui/icons-material";
import { Box, Button, Stack } from "@mui/material";
import AcademyBrandMark from "./AcademyBrandMark";
import { useAcademy } from "@/contexts/AcademyContext";

type TranslateFn = (no: string, en: string) => string;
type NavLabelFn = (label: string) => string;

type NavItem = {
  id: string;
  label: string;
  route: string;
  inset?: boolean;
};

type SidebarAction = {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
};

interface AcademyLeftSidebarProps {
  activeNav: string;
  onNavigate: (navId: string, route: string) => void;
  onCreateCourse: () => void;
  tt: TranslateFn;
  navLabel: NavLabelFn;
  activeCourseId?: string | null;
  currentLessonLabel?: string;
  bottomAction?: SidebarAction;
  footerContent?: React.ReactNode;
}

function AcademyLeftSidebar({
  activeNav,
  onNavigate,
  onCreateCourse,
  tt,
  navLabel,
  activeCourseId,
  currentLessonLabel,
  bottomAction,
  footerContent,
}: AcademyLeftSidebarProps) {
  const { state } = useAcademy();
  const [toolsExpanded, setToolsExpanded] = useState(
    activeNav === "tools" || activeNav.startsWith("tool-"),
  );

  useEffect(() => {
    if (activeNav === "tools" || activeNav.startsWith("tool-")) {
      setToolsExpanded(true);
    }
  }, [activeNav]);

  const leftNavItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      {
        id: "overview",
        label: navLabel("Overview"),
        route: "/academy-dashboard",
      },
      {
        id: "curriculum",
        label: navLabel("Course Foundation"),
        route: "/academy/curriculum",
      },
      {
        id: "course-creator",
        label: tt("Ferdighetsbygger", "Skills Builder"),
        route: "/academy/course-creator",
      },
      { id: "media", label: navLabel("Media"), route: "/academy/media" },
      {
        id: "assignments",
        label: navLabel("Assignments"),
        route: "/academy/assignments",
      },
      {
        id: "assignments-followup",
        label: tt("Oppfølging", "Follow-up"),
        route: "/academy/assignments?view=follow-up",
        inset: true,
      },
      {
        id: "assignments-transformation",
        label: tt("Transformasjonspuls", "Transformation Pulse"),
        route: "/academy/assignments?view=transformation-pulse",
        inset: true,
      },
      {
        id: "enrollment",
        label: navLabel("Enrollment"),
        route: "/academy/enrollment",
      },
      {
        id: "cohort",
        label: navLabel("Cohort Settings"),
        route: "/academy/cohort-settings",
      },
      {
        id: "analytics",
        label: navLabel("Analytics"),
        route: "/academy/analytics",
      },
      {
        id: "instructors",
        label: navLabel("Instructors"),
        route: "/academy/instructors",
      },
      { id: "tools", label: tt("Verktøy", "Tools"), route: "/academy/tools" },
      {
        id: "tool-annotation",
        label: navLabel("Annotation Studio"),
        route: "/academy/annotation-editor",
        inset: true,
      },
      {
        id: "tool-cta",
        label: navLabel("CTA Studio"),
        route: "/academy/cta-overlay",
        inset: true,
      },
      {
        id: "tool-lower-thirds",
        label: navLabel("Lower Thirds Studio"),
        route: "/academy/lower-thirds",
        inset: true,
      },
      {
        id: "tool-presentation",
        label: navLabel("Presentation Studio"),
        route: "/academy/presentation-overlay",
        inset: true,
      },
      {
        id: "tool-monetization",
        label: navLabel("Monetization"),
        route: "/academy/monetization",
        inset: true,
      },
      {
        id: "tool-quiz",
        label: navLabel("Quiz Studio"),
        route: "/academy/quiz-manager",
        inset: true,
      },
    ];

    void currentLessonLabel;

    return items;
  }, [currentLessonLabel, navLabel, tt]);

  const syncedCourseId = useMemo(() => {
    const fromProp = String(activeCourseId || "").trim();
    if (fromProp) return fromProp;

    const fromContext = String(state.currentCourse?.id || "").trim();
    if (fromContext) return fromContext;

    if (typeof window !== "undefined") {
      const fromRoute = String(
        new URLSearchParams(window.location.search).get("courseId") || "",
      ).trim();
      if (fromRoute) return fromRoute;
    }

    return "";
  }, [activeCourseId, state.currentCourse?.id]);

  const withCourseContext = useCallback(
    (route: string) => {
      if (!syncedCourseId) return route;
      const separator = route.includes("?") ? "&" : "?";
      const hasCourseParam =
        route.includes("courseId=") || route.includes("course_id=");
      return hasCourseParam
        ? route
        : `${route}${separator}courseId=${encodeURIComponent(syncedCourseId)}`;
    },
    [syncedCourseId],
  );

  const foundationSummary = useMemo(() => {
    const course = state.currentCourse;
    const architecture = course?.pedagogicalArchitecture;
    if (!course || !architecture) return null;

    const purpose = String(architecture.purpose || "").trim();
    const audience = String(architecture.audience || "").trim();
    return {
      title: String(course.title || "").trim(),
      purpose,
      audience,
      outcomes: Array.isArray(course.learningOutcomes)
        ? course.learningOutcomes.length
        : 0,
      problems: Array.isArray(architecture.problemsSolved)
        ? architecture.problemsSolved.length
        : 0,
    };
  }, [state.currentCourse]);

  return (
    <Box
      component="aside"
      sx={{
        width: "100%",
        maxWidth: "100%",
        flex: { xs: "0 0 auto", lg: "1 1 auto" },
        minWidth: 0,
        borderRight: {
          xs: "none",
          lg: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
        },
        borderBottom: {
          xs: "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)",
          lg: "none",
        },
        background:
          "linear-gradient(180deg, rgba(10,13,22,0.95), rgba(8,10,16,0.96))",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflowX: "clip",
      }}
    >
      <Stack spacing={2} sx={{ px: 2.5, py: 2.4 }}>
        <AcademyBrandMark />
        <Button
          variant="outlined"
          startIcon={<Add />}
          onClick={onCreateCourse}
          sx={{
            justifyContent: "flex-start",
            width: "100%",
            borderColor: "rgba(248,179,33,0.55)",
            color: "#f8d56f",
            borderRadius: 1,
            textTransform: "none",
            fontWeight: 600,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {tt("Opprett ny kompetanse", "Create New Competency")}
        </Button>
      </Stack>

      <Stack spacing={0.5} sx={{ px: 1.5 }}>
        {leftNavItems.map((item) => {
          const isToolChild = item.id.startsWith("tool-");
          if (isToolChild && !toolsExpanded) return null;

          const isInset = Boolean(item.inset);
          const active =
            item.id === activeNav ||
            (item.id === "tools" && activeNav.startsWith("tool-")) ||
            (item.id === "assignments" &&
              (activeNav === "assignments-followup" ||
                activeNav === "assignments-transformation")) ||
            (item.id === "lessons" && activeNav === "lesson-current");

          return (
            <Button
              key={item.id}
              onClick={() => {
                if (item.id === "tools") {
                  setToolsExpanded((prev) => !prev);
                }
                onNavigate(item.id, withCourseContext(item.route));
              }}
              endIcon={
                item.id === "tools" ? (
                  toolsExpanded ? (
                    <ExpandLess />
                  ) : (
                    <ExpandMore />
                  )
                ) : undefined
              }
              sx={{
                justifyContent: "flex-start",
                color: active
                  ? "#fce3a1"
                  : isInset
                    ? "rgba(237,240,247,0.74)"
                    : "rgba(237,240,247,0.82)",
                borderRadius: isInset ? 0.8 : 1,
                textTransform: "none",
                px: isInset ? 1.4 : 2,
                py: isInset ? 0.75 : 1.15,
                pl: isInset ? 1.8 : 2,
                width: "100%",
                border: isInset
                  ? "var(--academy-hairline-width, 1px) solid transparent"
                  : active
                    ? "var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)"
                    : "var(--academy-hairline-width, 1px) solid transparent",
                borderLeft: isInset
                  ? active
                    ? "2px solid rgba(248,179,33,0.55)"
                    : "2px solid rgba(255,255,255,0.18)"
                  : "none",
                background: isInset
                  ? active
                    ? "rgba(248,179,33,0.08)"
                    : "transparent"
                  : active
                    ? "linear-gradient(90deg, rgba(248,179,33,0.22), rgba(248,179,33,0.04))"
                    : "transparent",
                fontSize: isInset ? 13.5 : 15,
                boxSizing: "border-box",
                overflow: "hidden",
                "& .MuiButton-endIcon":
                  item.id === "tools" ? { ml: "auto" } : undefined,
              }}
            >
              {item.label}
            </Button>
          );
        })}
      </Stack>

      {foundationSummary ? (
        <Box
          sx={{
            mt: 1.2,
            mx: 1.5,
            p: 1.1,
            borderRadius: 1,
            border:
              "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.11)",
            background:
              "linear-gradient(145deg, rgba(14,18,30,0.82), rgba(10,13,22,0.9))",
          }}
        >
          <Box
            sx={{
              color: "rgba(248,213,111,0.94)",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            {tt("Kompetansegrunnlag", "Competency Foundation")}
          </Box>
          <Box
            sx={{
              color: "rgba(237,240,247,0.88)",
              fontSize: 12.5,
              fontWeight: 600,
              mt: 0.55,
              lineHeight: 1.25,
            }}
          >
            {foundationSummary.title || tt("Valgt kurs", "Selected course")}
          </Box>
          {foundationSummary.purpose ? (
            <Box
              sx={{
                color: "rgba(237,240,247,0.72)",
                fontSize: 11.5,
                mt: 0.45,
                lineHeight: 1.25,
              }}
            >
              {foundationSummary.purpose}
            </Box>
          ) : null}
          {foundationSummary.audience ? (
            <Box
              sx={{
                color: "rgba(237,240,247,0.62)",
                fontSize: 11,
                mt: 0.3,
                lineHeight: 1.25,
              }}
            >
              {foundationSummary.audience}
            </Box>
          ) : null}
          <Box
            sx={{
              color: "rgba(237,240,247,0.64)",
              fontSize: 10.8,
              mt: 0.6,
              lineHeight: 1.25,
            }}
          >
            {tt("Læringsmål", "Learning outcomes")}:{" "}
            {foundationSummary.outcomes} • {tt("Problemer", "Problems")}:{" "}
            {foundationSummary.problems}
          </Box>
        </Box>
      ) : null}

      {bottomAction ? (
        <Box sx={{ mt: "auto", p: 2 }}>
          <Button
            variant="text"
            startIcon={bottomAction.icon ?? <Add />}
            onClick={bottomAction.onClick}
            sx={{
              width: "100%",
              justifyContent: "flex-start",
              color: "#edf0f7",
              textTransform: "none",
              border:
                "var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)",
              borderRadius: 1,
            }}
          >
            {bottomAction.label}
          </Button>
        </Box>
      ) : null}

      {footerContent ? (
        <Box sx={{ px: 1.8, pb: 2 }}>{footerContent}</Box>
      ) : null}
    </Box>
  );
}

export default AcademyLeftSidebar;
