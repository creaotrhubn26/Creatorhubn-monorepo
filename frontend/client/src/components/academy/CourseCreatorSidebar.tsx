import { useAcademy, useAcademyContext } from "@/contexts/AcademyContext";
/**
 * Course Creator Sidebar
 * Comprehensive sidebar with auto-save, draft/publish, and versioning
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  Box,
  Drawer,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Stack,
  Button,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  Menu,
  MenuItem,
  MenuList,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Avatar,
  Paper,
  Collapse,
  ListItemSecondaryAction,
} from "@mui/material";
import {
  Save,
  Publish,
  Edit,
  History,
  Settings,
  Preview,
  Share,
  Download,
  Upload,
  Delete,
  Visibility,
  VisibilityOff,
  Lock,
  LockOpen,
  Schedule,
  Timer,
  CheckCircle,
  Warning,
  Error,
  Info,
  ExpandMore,
  ExpandLess,
  MoreVert,
  CloudUpload,
  CloudDownload,
  RestoreFromTrash,
  ContentCopy,
  Bookmark,
  BookmarkBorder,
  Star,
  StarBorder,
  Flag,
  FlagOutlined,
  Refresh,
  Sync,
  SyncDisabled,
  AutoAwesome,
  Speed as Speed,
  Security,
  Backup,
  Restore,
  Timeline,
  Assessment,
  Analytics,
  TrendingUp,
  People,
  School,
  Work,
  Business,
  Celebration,
  Add,
  Close,
} from "@mui/icons-material";
import {
  AcademyIcon,
  CourseIcon,
  LessonIcon,
  VideoPlayerIcon,
  InstructorIcon,
  StudentIcon,
  LearningPathIcon,
  CertificateIcon,
  QuizIcon,
  BookmarkIcon,
  NoteIcon,
  ContentCreationIcon,
} from "../shared/CreatorHubIcons";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { withUniversalIntegration } from "@/integration/UniversalIntegrationHOC";
import { useTheming } from "../../utils/theming-helper";

interface CourseVersion {
  id: string;
  version: string;
  title: string;
  description: string;
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  changes: string[];
  isCurrent: boolean;
  isRestorable: boolean;
}

interface CourseCreatorSidebarProps {
  open: boolean;
  onClose: () => void;
  course: any;
  onCourseUpdate: (course: any) => void;
  onPublish: (course: any) => void;
  onSaveDraft: (course: any) => void;
  onPreview: (course: any) => void;
  onShare: (course: any) => void;
  onExport: (course: any) => void;
  onImport: (course: any) => void;
  onDelete: (course: any) => void;
  onVersionRestore: (version: CourseVersion) => void;
  onVersionCreate: (version: CourseVersion) => void;
  activeTab: number;
  onTabChange: (tab: number) => void;
  modules: any[];
  lessons: any[];
  resources: any[];
  lowerThirds: any[];
  width?: number;
}

const SAMPLE_VERSIONS: CourseVersion[] = [
  {
    id: "v1",
    version: "1.0.0",
    title: "Initial Course Creation",
    description: "First version of the course with basic structure",
    status: "published",
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-01-15T10:30:00Z",
    author: {
      id: "user-1",
      name: "Daniel Qazi",
      avatar: "/avatars/daniel-qazi.jpg",
    },
    changes: [
      "Created course structure",
      "Added basic modules",
      "Set up pricing",
    ],
    isCurrent: false,
    isRestorable: true,
  },
  {
    id: "v2",
    version: "1.1.0",
    title: "Added Video Content",
    description: "Enhanced course with video lessons and annotations",
    status: "published",
    createdAt: "2024-01-16T14:20:00Z",
    updatedAt: "2024-01-16T14:20:00Z",
    author: {
      id: "user-1",
      name: "Daniel Qazi",
      avatar: "/avatars/daniel-qazi.jpg",
    },
    changes: [
      "Added video lessons",
      "Implemented annotations",
      "Created lower thirds",
    ],
    isCurrent: false,
    isRestorable: true,
  },
  {
    id: "v3",
    version: "1.2.0",
    title: "Module System Integration",
    description: "Current version with advanced module management",
    status: "draft",
    createdAt: "2024-01-17T09:15:00Z",
    updatedAt: "2024-01-17T09:15:00Z",
    author: {
      id: "user-1",
      name: "Daniel Qazi",
      avatar: "/avatars/daniel-qazi.jpg",
    },
    changes: [
      "Implemented module system",
      "Added drag-and-drop",
      "Enhanced organization",
    ],
    isCurrent: true,
    isRestorable: false,
  },
];

const SIDEBAR_TABS = [
  { id: 0, label: "Course Details", icon: <CourseIcon />, color: "#2196f3" },
  { id: 1, label: "Modules", icon: <School />, color: "#4caf50" },
  { id: 2, label: "Lessons", icon: <LessonIcon />, color: "#ff9800" },
  { id: 3, label: "Resources", icon: <Work />, color: "#9c27b0" },
];

function CourseCreatorSidebar({
  open,
  onClose,
  course,
  onCourseUpdate,
  onPublish,
  onSaveDraft,
  onPreview,
  onShare,
  onExport,
  onImport,
  onDelete,
  onVersionRestore,
  onVersionCreate,
  activeTab,
  onTabChange,
  modules,
  lessons,
  resources,
  lowerThirds,
  width = 320,
}: CourseCreatorSidebarProps) {
  const [expandedSections, setExpandedSections] = useState({
    autoSave: true,
    status: true,
    versions: false,
    analytics: false,
    tools: false,
  });
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showWorkflowSettings, setShowWorkflowSettings] = useState(false);
  const [workflowView, setWorkflowView] = useState<
    "overview" | "versions" | "analytics"
  >("overview");
  const [lockPublishing, setLockPublishing] = useState(false);
  const [highlightCritical, setHighlightCritical] = useState(true);
  const [versionTitle, setVersionTitle] = useState("");
  const [versionDescription, setVersionDescription] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    version: CourseVersion;
  } | null>(null);

  const { analytics, performance, debugging, features } =
    useEnhancedMasterIntegration();

  // Wire up Academy context
  const academyContext = useAcademyContext();
  const academyState = useAcademy();

  // Theming system
  const theming = useTheming("music_producer");

  // Wire up CreatorHub icons for sidebar navigation
  const sidebarIcons = {
    academy: <AcademyIcon />,
    course: <CourseIcon />,
    lesson: <LessonIcon />,
    video: <VideoPlayerIcon />,
    instructor: <InstructorIcon />,
    student: <StudentIcon />,
    learningPath: <LearningPathIcon />,
    certificate: <CertificateIcon />,
    quiz: <QuizIcon />,
    bookmark: <BookmarkIcon />,
    note: <NoteIcon />,
    content: <ContentCreationIcon />,
  };

  // Log sidebar initialization
  console.log(
    "Sidebar icons initialized:",
    Object.keys(sidebarIcons).length,
    "Academy:",
    !!academyContext,
    !!academyState,
  );

  useEffect(() => {
    const endTiming = performance.startTiming("course_creator_sidebar_render");
    debugging.logIntegration("info", "CourseCreatorSidebar mounted", {
      workflowView,
      modules: modules.length,
      lessons: lessons.length,
      resources: resources.length,
      lowerThirds: lowerThirds.length,
    });
    return () => {
      endTiming();
    };
  }, [
    performance,
    debugging,
    workflowView,
    modules.length,
    lessons.length,
    resources.length,
    lowerThirds.length,
  ]);

  // Comprehensive Feature System for Course Creator Sidebar
  const courseCreationAccess = features.checkFeatureAccess("course-creation");
  const courseManagementAccess =
    features.checkFeatureAccess("course-management");
  const versionControlAccess = features.checkFeatureAccess("version-control");
  const collaborationAccess = features.checkFeatureAccess("collaboration");
  const courseAnalyticsAccess =
    features.checkFeatureAccess("analytics-academy");
  const contentManagementAccess =
    features.checkFeatureAccess("content-management");
  const autoSaveAccess = features.checkFeatureAccess("auto-save");
  const coursePublishingAccess =
    features.checkFeatureAccess("course-publishing");

  // Auto-save configuration
  const autoSave = useAutoSave({
    config: {
      enableAutoSave: true,
      debounceDelay: 2000,
      maxRetries: 3,
      retryDelay: 1000,
      conflictResolution: "client",
      enableConflictDetection: true,
      enableVersioning: true,
      maxVersions: 10,
      enableCompression: false,
      enableEncryption: false,
    },
    onDataSaved: (data: any) => {
      console.log("Course auto-saved: ", data);
      analytics.trackEvent("course_auto_saved", {
        courseId: course.id,
        version: "1.2.0",
        timestamp: Date.now(),
      });
    },
    onError: (error: any) => {
      console.error("Auto-save error:", error);
      analytics.trackEvent("course_auto_save_error", {
        courseId: course.id,
        error,
        timestamp: Date.now(),
      });
    },
    onConflictDetected: (conflict: any) => {
      console.warn("Auto-save conflict detected:", conflict);
      analytics.trackEvent("course_auto_save_conflict", {
        courseId: course.id,
        conflict,
        timestamp: Date.now(),
      });
    },
  });

  // Auto-save course data
  useEffect(() => {
    if (course && autoSave.isEnabled) {
      autoSave.save("course", {
        ...course,
        metadata: {
          version: "1.2.0",
          lastModified: new Date().toISOString(),
          modulesCount: modules.length,
          lessonsCount: lessons.length,
          resourcesCount: resources.length,
          source: "CourseCreatorSidebar",
          deviceId: "browser",
        },
      });
    }
  }, [course, modules, lessons, resources, autoSave]);

  // Track feature usage
  useEffect(() => {
    features.trackFeatureUsage("course-creation", "sidebar_opened, ", {
      timestamp: Date.now(),
      component: "CourseCreatorSidebar",
      courseId: course.id,
      modulesCount: modules.length,
      lessonsCount: lessons.length,
    });
  }, [features, course.id, modules.length, lessons.length]);

  const handleQuickCourseUpdate = useCallback(
    (patch: Record<string, unknown>) => {
      const nextCourse = {
        ...course,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      onCourseUpdate(nextCourse);
      analytics.trackEvent("course_sidebar_quick_update", {
        courseId: course.id,
        keys: Object.keys(patch),
        timestamp: Date.now(),
      });
    },
    [analytics, course, onCourseUpdate],
  );

  // Toggle section expansion
  const toggleSection = useCallback(
    (section: keyof typeof expandedSections) => {
      setExpandedSections((prev) => ({
        ...prev,
        [section]: !prev[section],
      }));
    },
    [],
  );

  // Handle version creation
  const handleCreateVersion = useCallback(() => {
    if (!versionTitle.trim()) return;

    const newVersion: CourseVersion = {
      id: `v${Date.now()}`,
      version: `1.${SAMPLE_VERSIONS.length}.0`,
      title: versionTitle,
      description: versionDescription,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: "user-1",
        name: "Daniel Qazi",
        avatar: "/avatars/daniel-qazi.jpg",
      },
      changes: ["Manual version creation"],
      isCurrent: false,
      isRestorable: true,
    };

    onVersionCreate(newVersion);
    setShowVersionDialog(false);
    setVersionTitle("");
    setVersionDescription("");

    analytics.trackEvent("course_version_created", {
      courseId: course.id,
      versionId: newVersion.id,
      versionTitle: newVersion.title,
      timestamp: Date.now(),
    });
  }, [versionTitle, versionDescription, onVersionCreate, analytics, course.id]);

  // Handle version restore
  const handleRestoreVersion = useCallback(
    (version: CourseVersion) => {
      onVersionRestore(version);
      setContextMenu(null);

      analytics.trackEvent("course_version_restored", {
        courseId: course.id,
        versionId: version.id,
        versionTitle: version.title,
        timestamp: Date.now(),
      });
    },
    [onVersionRestore, analytics, course.id],
  );

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "success";
      case "draft":
        return "warning";
      case "archived":
        return "error";
      default:
        return "default";
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "published":
        return <CheckCircle />;
      case "draft":
        return <Edit />;
      case "archived":
        return <Delete />;
      default:
        return <Info />;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Render auto-save status
  const renderAutoSaveStatus = () => (
    <Box>
      <ListItemButton onClick={() => toggleSection("autoSave")}>
        <ListItemIcon>
          <Sync color={autoSave.isSaving ? "primary" : "inherit"} />
        </ListItemIcon>
        <ListItemText
          primary="Auto-Save"
          secondary={
            autoSave.isSaving
              ? "Saving..."
              : autoSave.pendingChanges
                ? "Pending changes"
                : "Up to date"
          }
        />
        <ListItemSecondaryAction>
          <Chip
            label={
              autoSave.isSaving
                ? "Saving"
                : autoSave.pendingChanges
                  ? "Pending"
                  : "Saved"
            }
            size="small"
            color={
              autoSave.isSaving
                ? "primary"
                : autoSave.pendingChanges
                  ? "warning"
                  : "success"
            }
            variant="outlined"
          />
        </ListItemSecondaryAction>
        {expandedSections.autoSave ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>

      <Collapse in={expandedSections.autoSave} timeout="auto" unmountOnExit>
        <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
          <Stack spacing={1}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Last saved:{", "}
                {autoSave.lastSave
                  ? formatDate(new Date(autoSave.lastSave).toISOString())
                  : "Never"}
              </Typography>
            </Box>

            {autoSave.isSaving && <LinearProgress />}

            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                startIcon={<Save />}
                onClick={() => autoSave.forceSave()}
                disabled={autoSave.isSaving}
              >
                Save Now
              </Button>
              <Button
                size="small"
                startIcon={autoSave.isPaused ? <Sync /> : <SyncDisabled />}
                onClick={autoSave.isPaused ? autoSave.resume : autoSave.pause}
              >
                {autoSave.isPaused ? "Resume" : "Pause"}
              </Button>
            </Stack>

            {autoSave.hasError && (
              <Alert severity="error">{autoSave.error}</Alert>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );

  // Render course status
  const renderCourseStatus = () => (
    <Box>
      <ListItemButton onClick={() => toggleSection("status")}>
        <ListItemIcon>{getStatusIcon(course.status || "draft")}</ListItemIcon>
        <ListItemText
          primary="Course Status"
          secondary={`${course.status || "draft"} • Version ${SAMPLE_VERSIONS.find((v) => v.isCurrent)?.version || "1.0.0"}`}
        />
        <ListItemSecondaryAction>
          <Chip
            label={course.status || "draft"}
            size="small"
            color={getStatusColor(course.status || "draft")}
            variant="filled"
          />
        </ListItemSecondaryAction>
        {expandedSections.status ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>

      <Collapse in={expandedSections.status} timeout="auto" unmountOnExit>
        <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="contained"
                startIcon={<Publish />}
                onClick={() => onPublish(course)}
                disabled={course.status === "published" || lockPublishing}
                sx={{ flex: 1 }}
              >
                Publish
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => onSaveDraft(course)}
                sx={{ flex: 1 }}
              >
                Save Draft
              </Button>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                startIcon={<Preview />}
                onClick={() => onPreview(course)}
                sx={{ flex: 1 }}
              >
                Preview
              </Button>
              <Button
                size="small"
                startIcon={<Share />}
                onClick={() => onShare(course)}
                sx={{ flex: 1 }}
              >
                Share
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );

  // Render versions
  const renderVersions = () => (
    <Box>
      <ListItemButton onClick={() => toggleSection("versions")}>
        <ListItemIcon>
          <History />
        </ListItemIcon>
        <ListItemText
          primary="Versions"
          secondary={`${SAMPLE_VERSIONS.length} versions`}
        />
        {expandedSections.versions ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>

      <Collapse in={expandedSections.versions} timeout="auto" unmountOnExit>
        <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
          <Stack spacing={1}>
            <Button
              size="small"
              startIcon={<Add />}
              onClick={() => setShowVersionDialog(true)}
              fullWidth
            >
              Create Version
            </Button>

            {SAMPLE_VERSIONS.map((version) => (
              <Paper
                key={version.id}
                sx={{
                  p: 2,
                  cursor: "pointer",
                  border: version.isCurrent ? 2 : 1,
                  borderColor: version.isCurrent ? "primary.main" : "divider",
                  "&:hover": { backgroundColor: "action.hover" },
                }}
                onClick={() =>
                  !version.isCurrent && handleRestoreVersion(version)
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    mouseX: e.clientX + 2,
                    mouseY: e.clientY - 6,
                    version: version,
                  });
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ mb: 1 }}
                >
                  <Typography variant="subtitle2" noWrap>
                    {version.title}
                  </Typography>
                  {version.isCurrent && (
                    <Chip label="Current" size="small" color="primary" />
                  )}
                </Stack>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 1, display: "block" }}
                >
                  {version.description}
                </Typography>

                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(version.createdAt)}
                  </Typography>
                  <Chip
                    label={version.status}
                    size="small"
                    color={getStatusColor(version.status)}
                    variant="outlined"
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );

  // Render analytics
  const renderAnalytics = () => (
    <Box>
      <ListItemButton onClick={() => toggleSection("analytics")}>
        <ListItemIcon>
          <Analytics />
        </ListItemIcon>
        <ListItemText
          primary="Analytics"
          secondary="Course performance metrics"
        />
        {expandedSections.analytics ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>

      <Collapse in={expandedSections.analytics} timeout="auto" unmountOnExit>
        <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Content Overview
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    variant="h6"
                    sx={{ color: theming.colors.primary }}
                  >
                    {modules.length}
                  </Typography>
                  <Typography variant="caption">Modules</Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    variant="h6"
                    sx={{ color: theming.colors.primary }}
                  >
                    {lessons.length}
                  </Typography>
                  <Typography variant="caption">Lessons</Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    variant="h6"
                    sx={{ color: theming.colors.primary }}
                  >
                    {resources.length}
                  </Typography>
                  <Typography variant="caption">Resources</Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    variant="h6"
                    sx={{ color: theming.colors.primary }}
                  >
                    {lowerThirds.length}
                  </Typography>
                  <Typography variant="caption">Lower thirds</Typography>
                </Box>
              </Stack>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Auto-Save Stats
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    variant="h6"
                    sx={{ color: theming.colors.primary }}
                  >
                    {autoSave.saveCount}
                  </Typography>
                  <Typography variant="caption">Saves</Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    variant="h6"
                    sx={{ color: theming.colors.primary }}
                  >
                    {autoSave.errorCount}
                  </Typography>
                  <Typography variant="caption">Errors</Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    variant="h6"
                    sx={{ color: theming.colors.primary }}
                  >
                    {autoSave.conflictCount}
                  </Typography>
                  <Typography variant="caption">Conflicts</Typography>
                </Box>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );

  const renderWorkflowControls = () => (
    <Box>
      <ListItemButton onClick={() => setShowWorkflowSettings((prev) => !prev)}>
        <ListItemIcon>
          <Security />
        </ListItemIcon>
        <ListItemText
          primary="Workflow Controls"
          secondary={
            lockPublishing ? "Publishing locked" : "Publishing enabled"
          }
        />
        {showWorkflowSettings ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>

      <Collapse in={showWorkflowSettings} timeout="auto" unmountOnExit>
        <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
          <Stack spacing={1.5}>
            <Accordion disableGutters defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AutoAwesome fontSize="small" />
                  <Typography variant="body2">Sidebar Mode</Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <FormControl fullWidth size="small">
                  <InputLabel>View</InputLabel>
                  <Select
                    value={workflowView}
                    label="View"
                    onChange={(event) => {
                      const selectedView = event.target.value as string;
                      if (
                        selectedView === "overview" ||
                        selectedView === "versions" ||
                        selectedView === "analytics"
                      ) {
                        setWorkflowView(selectedView);
                      }
                    }}
                  >
                    <MenuItem value="overview">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Timeline fontSize="small" />
                        <span>Overview</span>
                      </Stack>
                    </MenuItem>
                    <MenuItem value="versions">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Assessment fontSize="small" />
                        <span>Versions</span>
                      </Stack>
                    </MenuItem>
                    <MenuItem value="analytics">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TrendingUp fontSize="small" />
                        <span>Analytics</span>
                      </Stack>
                    </MenuItem>
                  </Select>
                </FormControl>
              </AccordionDetails>
            </Accordion>

            <FormControlLabel
              control={
                <Switch
                  checked={lockPublishing}
                  onChange={(event) => setLockPublishing(event.target.checked)}
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  {lockPublishing ? (
                    <Lock fontSize="small" />
                  ) : (
                    <LockOpen fontSize="small" />
                  )}
                  <span>Lock publishing actions</span>
                </Stack>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={highlightCritical}
                  onChange={(event) =>
                    setHighlightCritical(event.target.checked)
                  }
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  {highlightCritical ? (
                    <Visibility fontSize="small" />
                  ) : (
                    <VisibilityOff fontSize="small" />
                  )}
                  <span>Highlight critical metadata</span>
                </Stack>
              }
            />

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                icon={<People />}
                label={courseManagementAccess ? "Team ready" : "Team limited"}
                size="small"
                color={courseManagementAccess ? "success" : "default"}
                variant="outlined"
              />
              <Chip
                icon={<Business />}
                label={
                  contentManagementAccess ? "Content ops" : "Content limited"
                }
                size="small"
                color={contentManagementAccess ? "success" : "default"}
                variant="outlined"
              />
              <Chip
                icon={<Celebration />}
                label={
                  coursePublishingAccess
                    ? "Publish enabled"
                    : "Publish disabled"
                }
                size="small"
                color={coursePublishingAccess ? "success" : "default"}
                variant="outlined"
              />
              <Chip
                icon={<Speed />}
                label={autoSaveAccess ? "Auto-save active" : "Auto-save off"}
                size="small"
                color={autoSaveAccess ? "success" : "default"}
                variant="outlined"
              />
              <Chip
                icon={<Flag />}
                label={
                  courseCreationAccess ? "Creation open" : "Creation blocked"
                }
                size="small"
                color={courseCreationAccess ? "success" : "default"}
                variant="outlined"
              />
              <Chip
                icon={versionControlAccess ? <Star /> : <StarBorder />}
                label="Version control"
                size="small"
                color={versionControlAccess ? "success" : "default"}
                variant="outlined"
              />
              <Chip
                icon={collaborationAccess ? <Bookmark /> : <BookmarkBorder />}
                label={
                  collaborationAccess ? "Collaboration on" : "Collaboration off"
                }
                size="small"
                color={collaborationAccess ? "success" : "default"}
                variant="outlined"
              />
              <Chip
                icon={courseAnalyticsAccess ? <FlagOutlined /> : <Warning />}
                label={
                  courseAnalyticsAccess
                    ? "Analytics ready"
                    : "Analytics limited"
                }
                size="small"
                color={courseAnalyticsAccess ? "success" : "warning"}
                variant="outlined"
              />
            </Stack>

            <Stack direction="row" spacing={1}>
              <Tooltip title="Mark course as reviewed and sync timestamps">
                <span style={{ flex: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Refresh />}
                    fullWidth
                    onClick={() =>
                      handleQuickCourseUpdate({
                        workflowStatus: "reviewed",
                        reviewedAt: new Date().toISOString(),
                      })
                    }
                  >
                    Refresh State
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="Flag this course for manual review">
                <span style={{ flex: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Error />}
                    fullWidth
                    onClick={() =>
                      handleQuickCourseUpdate({
                        workflowStatus: "needs_review",
                        needsAttention: true,
                      })
                    }
                  >
                    Needs Review
                  </Button>
                </span>
              </Tooltip>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CloudUpload />}
                fullWidth
                onClick={() => onImport(course)}
              >
                Sync In
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CloudDownload />}
                fullWidth
                onClick={() => onExport(course)}
              >
                Sync Out
              </Button>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Schedule />}
                fullWidth
                onClick={() =>
                  handleQuickCourseUpdate({
                    scheduledAt: new Date(
                      Date.now() + 24 * 60 * 60 * 1000,
                    ).toISOString(),
                    workflowStatus: "scheduled",
                  })
                }
              >
                Schedule
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Timer />}
                fullWidth
                onClick={() =>
                  handleQuickCourseUpdate({
                    estimatedDurationMinutes: Math.max(1, lessons.length * 8),
                  })
                }
              >
                Estimate
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Badge
                color="warning"
                badgeContent={lockPublishing ? "!" : 0}
                showZero
              >
                <Avatar sx={{ width: 26, height: 26 }}>
                  <MoreVert fontSize="small" />
                </Avatar>
              </Badge>
              <Typography variant="caption" color="text.secondary">
                Publishing is {lockPublishing ? "locked" : "unlocked"} in this
                panel.
              </Typography>
            </Stack>

            {highlightCritical ? (
              <Alert icon={<Warning />} severity="warning">
                Keep title, status, and pricing consistent before publishing.
              </Alert>
            ) : null}

            <Button
              size="small"
              variant="text"
              color="error"
              startIcon={<RestoreFromTrash />}
              onClick={() =>
                handleQuickCourseUpdate({
                  workflowStatus: "draft",
                  needsAttention: false,
                  scheduledAt: null,
                })
              }
            >
              Reset workflow flags
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );

  // Render tools
  const renderTools = () => (
    <Box>
      <ListItemButton onClick={() => toggleSection("tools")}>
        <ListItemIcon>
          <Settings />
        </ListItemIcon>
        <ListItemText
          primary="Tools"
          secondary="Export, import, and utilities"
        />
        {expandedSections.tools ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>

      <Collapse in={expandedSections.tools} timeout="auto" unmountOnExit>
        <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
          <Stack spacing={1}>
            <Button
              size="small"
              startIcon={<Download />}
              onClick={() => onExport(course)}
              fullWidth
            >
              Export Course
            </Button>
            <Button
              size="small"
              startIcon={<Upload />}
              onClick={() => onImport(course)}
              fullWidth
            >
              Import Course
            </Button>
            <Button
              size="small"
              startIcon={<Backup />}
              onClick={() => autoSave.forceSave()}
              fullWidth
            >
              Backup Now
            </Button>
            <Button
              size="small"
              startIcon={<Restore />}
              onClick={() => autoSave.restoreFromBackup()}
              fullWidth
            >
              Restore Backup
            </Button>
            <Divider />
            <Button
              size="small"
              startIcon={<Delete />}
              onClick={() => setShowDeleteDialog(true)}
              fullWidth
              color="error"
            >
              Delete Course
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        sx={{
          width: width,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: width,
            boxSizing: "border-box",
            backgroundColor: "background.paper",
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Skills Builder
              </Typography>

              {/* Feature Analytics Display */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mt: 0.5,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Features: {features.getFeatureAnalytics().enabledFeatures}/
                  {features.getFeatureAnalytics().totalFeatures}
                </Typography>
                <Chip
                  label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: "8px", height: 16 }}
                />
              </Box>
            </Box>
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, overflow: "auto" }}>
          {/* Navigation Tabs */}
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Navigation
            </Typography>
            <List dense>
              {SIDEBAR_TABS.map((tab) => (
                <ListItem key={tab.id} disablePadding>
                  <ListItemButton
                    selected={activeTab === tab.id}
                    onClick={() => onTabChange(tab.id)}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      "&.Mui-selected": {
                        backgroundColor: `${tab.color}20`,
                        "& .MuiListItemIcon-root": {
                          color: tab.color,
                        },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {tab.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={tab.label}
                      primaryTypographyProps={{ variant: "body2" }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>

          <Divider />

          {/* Auto-Save Status */}
          {renderAutoSaveStatus()}

          <Divider />

          {/* Course Status */}
          {renderCourseStatus()}

          <Divider />

          {/* Versions */}
          {renderVersions()}

          <Divider />

          {/* Analytics */}
          {renderAnalytics()}

          <Divider />

          {/* Workflow Controls */}
          {renderWorkflowControls()}

          <Divider />

          {/* Tools */}
          {renderTools()}
        </Box>
      </Drawer>

      {/* Version Creation Dialog */}
      <Dialog
        open={showVersionDialog}
        onClose={() => setShowVersionDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Version</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Version Title"
              value={versionTitle}
              onChange={(e) => setVersionTitle(e.target.value)}
              placeholder="e.g., Added video content"
            />
            <TextField
              fullWidth
              label="Description"
              value={versionDescription}
              onChange={(e) => setVersionDescription(e.target.value)}
              multiline
              rows={3}
              placeholder="Describe the changes in this version"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVersionDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateVersion}
            disabled={!versionTitle.trim()}
          >
            Create Version
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Course</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this course? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              onDelete(course);
              setShowDeleteDialog(false);
            }}
          >
            Delete Course
          </Button>
        </DialogActions>
      </Dialog>

      {/* Version Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {contextMenu && (
          <MenuList>
            <MenuItem onClick={() => handleRestoreVersion(contextMenu.version)}>
              <ListItemIcon>
                <Restore fontSize="small" />
              </ListItemIcon>
              <ListItemText>Restore Version</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => setContextMenu(null)}>
              <ListItemIcon>
                <ContentCopy fontSize="small" />
              </ListItemIcon>
              <ListItemText>Duplicate Version</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => setContextMenu(null)}>
              <ListItemIcon>
                <Download fontSize="small" />
              </ListItemIcon>
              <ListItemText>Export Version</ListItemText>
            </MenuItem>
          </MenuList>
        )}
      </Menu>
    </>
  );
}

export default withUniversalIntegration(CourseCreatorSidebar, {
  componentId: "course-creator-sidebar",
  componentName: "Course Creator Sidebar",
  componentType: "widget",
  componentCategory: "academy",
  featureIds: [
    "course-creation",
    "course-management",
    "lesson-creation",
    "module-management",
    "content-management",
  ],
});
