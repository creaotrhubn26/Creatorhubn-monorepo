// @ts-nocheck
/**
 * RoleRoomDashboardPanel — main panel rendered inside UniversalDashboard
 *
 * Shows:
 *  1. Projects list (with sync status)
 *  2. Casting roles / candidates for selected project
 *  3. Crew members
 *  4. Schedule timeline
 *  5. Quick sync action
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import '../../styles/role-room-mobile.css';
import { useAuth } from '../../hooks/useAuth';
import { useRoleRoomViewportMode } from './hooks/useRoleRoomViewportMode';
import { useProducerNotifications } from './hooks/useProducerNotifications';
import { useProducerReviews } from './hooks/useProducerReviews';
import { useProducerTimeline } from './hooks/useProducerTimeline';
import RoleRoomMobileTopBar, { MobileSyncStatus } from './components/RoleRoomMobileTopBar';
import RoleRoomTabRail, { type TabRailItem } from './components/ipad/RoleRoomTabRail';
import RoleRoomBottomNav, {
  type BottomNavItem,
} from './components/mobile/RoleRoomBottomNav';
import {
  useEffectiveTabsForRole,
  type SubTabValue,
} from './hooks/useRoleNavConfig';
import RoleRoomProjectSwitcher from './components/RoleRoomProjectSwitcher';
import RoleRoomMobileInboxSheet, { InboxItem } from './components/RoleRoomMobileInboxSheet';
import RoleRoomMobileProfileSheet from './components/RoleRoomMobileProfileSheet';
import ProjectTabAccessDialog from './components/ProjectTabAccessDialog';
import ProjectMembersDialog from './components/ProjectMembersDialog';
import { roleRoomProjectTabConfigService } from './services/roleRoomProjectTabConfigService';
import RoleRoomMobileApprovalView from './components/mobile-approval/RoleRoomMobileApprovalView';
import RoleRoomOnboardingDialog from './components/RoleRoomOnboardingDialog';
import { roleRoomMemberProfileService } from './services/roleRoomMemberProfileService';
import RoleRoomMobileBriefWizard from './components/mobile-brief/RoleRoomMobileBriefWizard';
import RoleRoomMobilePlannerView from './components/mobile-planner/RoleRoomMobilePlannerView';
import RoleRoomMobileShootingDayView from './components/production-mobile/RoleRoomMobileShootingDayView';
import RoleRoomMobileShotListView from './components/production-mobile/RoleRoomMobileShotListView';
import RoleRoomMobileCrewView from './components/production-mobile/RoleRoomMobileCrewView';
import RoleRoomAgentChatPanel from './components/ai/RoleRoomAgentChatPanel';
import CarouselPanel from './components/producer/carousel/CarouselPanel';
import GrantedAssetsCard from './components/producer/GrantedAssetsCard';
import ClientEconomyPanel from './components/producer/ClientEconomyPanel';
import AdminRoom from '../../pages/AdminRoom';
import { useRoleRoomAgentContext } from './hooks/useRoleRoomAgentContext';
import { validateAgentToolInput } from './services/roleRoomAgentToolSchemas';
import { logAgentToolResult } from './services/roleRoomAgentClaudeApi';
import { roleRoomAnalytics } from './services/roleRoomAnalytics';
import {
  readLastWorkspace,
  saveLastWorkspace,
  readRecentProjects,
  pushRecentProject,
} from './state/roleRoomWorkspacePersistence';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  IconButton,
  Chip,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tabs,
  Tab,
  Avatar,
  AvatarGroup,
  LinearProgress,
  Alert,
  Skeleton,
  Tooltip,
  Grid,
  Badge,
  Stack,
  Paper,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Sync as SyncIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Tune as TuneIcon,
  Movie as MovieIcon,
  CalendarMonth as CalendarIcon,
  TheaterComedy as TheaterIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  FolderOpen as FolderIcon,
  Refresh as RefreshIcon,
  LinkOff as LinkOffIcon,
  Link as LinkIcon,
  YouTube as YouTubeIcon,
  AutoFixHigh as AutoFixHighIcon,
  AccountCircle as AccountCircleIcon,
  Paid as PaidIcon,
} from '@mui/icons-material';
import { getActiveProfessionMode, isDanceMode, isProductionMode } from './config/professionMode';
import { PostAgentReadyCard } from './components/PostAgentReadyCard';
import { PostAgentCrewWelcomeBanner } from './components/PostAgentCrewWelcomeBanner';
import { PostAgentErrorBoundary } from './components/PostAgentErrorBoundary';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { DanceWorkspace } from './dance';

import {
  useRoleRoomProjects,
  useRoleRoomProject,
  useCreateProject,
  useDeleteProject,
  useCastingRoles,
  useCandidates,
  useCrew,
  useSchedules,
  useProjectUserRoles,
  useSyncProject,
  useCreateCastingRole,
  useAddCandidate,
  useAddCrewMember,
  useRoleRoomBootstrap,
} from '../../hooks/useRoleRoom';
import RoleRoomBrandMark from './components/shared/RoleRoomBrandMark';
import { YouTubeIntegration, type YouTubePublishingSuggestion } from '../youtube/YouTubeIntegration';
import GoogleWorkspaceSessionBadge from '../universal/GoogleWorkspaceSessionBadge';
import {
  roleRoomAgentService,
  type RoleRoomAgentAccess,
  type RoleRoomAgentProducerBootstrapResult,
} from './services/roleRoomAgentService';

import type {
  CastingProject,
  CastingRole,
  Candidate,
  CrewMember,
  UserRole,
} from '../../../../shared/role-room-types';

// ── Helpers ──────────────────────────────────────────────────

function statusColor(s: string): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  switch (s) {
    case 'active': return 'primary';
    case 'completed': return 'success';
    case 'archived': return 'default';
    case 'draft': return 'warning';
    default: return 'default';
  }
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function readFirstText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

function buildRoleRoomPublishingSuggestion(
  projectName: string | undefined,
  snapshot: RoleRoomAgentProducerBootstrapResult | null,
): YouTubePublishingSuggestion | null {
  if (!snapshot) {
    return null;
  }

  const activation = snapshot.planningDraft.activationPlan;
  const logic = snapshot.planningDraft.contentLogic;
  const company = snapshot.companyProfile;
  const titleSeed = readFirstText(
    activation.idea,
    logic.hook,
    logic.coreMessage,
    snapshot.intakeDraft.projectGoal,
    company.companyName,
  );

  const tags = [
    company.industry,
    company.subIndustry,
    company.contentCategory,
    logic.contentCategory,
    logic.productionApproach,
    ...company.offerings,
    ...company.targetAudience,
    ...(logic.proofPoints ?? []),
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .slice(0, 10);

  const descriptionSections = [
    readFirstText(snapshot.intakeDraft.projectGoal) ? `Mål\n${snapshot.intakeDraft.projectGoal.trim()}` : '',
    readFirstText(logic.audience, snapshot.intakeDraft.targetAudience) ? `Målgruppe\n${readFirstText(logic.audience, snapshot.intakeDraft.targetAudience)}` : '',
    readFirstText(logic.hook, activation.idea) ? `Hook\n${readFirstText(logic.hook, activation.idea)}` : '',
    readFirstText(logic.coreMessage, activation.coreMessage, snapshot.intakeDraft.keyMessage) ? `Kjernebudskap\n${readFirstText(logic.coreMessage, activation.coreMessage, snapshot.intakeDraft.keyMessage)}` : '',
    logic.proofPoints && logic.proofPoints.length > 0 ? `Bevispunkter\n• ${logic.proofPoints.slice(0, 4).join('\n• ')}` : '',
    readFirstText(logic.callToAction) ? `CTA\n${logic.callToAction?.trim()}` : '',
    readFirstText(snapshot.planningDraft.brandGuide.toneOfVoice, company.summary) ? `Tone\n${readFirstText(snapshot.planningDraft.brandGuide.toneOfVoice, company.summary)}` : '',
  ].filter(Boolean);

  return {
    sourceLabel: 'The Role Room Agent',
    summary: readFirstText(
      activation.direction,
      logic.distributionPlan,
      company.summary,
      snapshot.nextRecommendedSteps[0],
    ),
    title: readFirstText(
      projectName ? `${projectName} | ${titleSeed}` : titleSeed,
      projectName ? `${projectName} | Ny publisering` : '',
    ),
    description: descriptionSections.join('\n\n'),
    tags,
    playlistTitle: readFirstText(
      projectName && company.companyName ? `${projectName} | ${company.companyName}` : '',
      projectName ? `${projectName} | YouTube playlist` : '',
      company.companyName ? `${company.companyName} | YouTube playlist` : '',
    ),
    chips: [
      company.industry,
      logic.contentCategory,
      logic.productionApproach,
      snapshot.planningDraft.brandGuide.toneOfVoice,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    nextSteps: snapshot.nextRecommendedSteps ?? [],
  };
}

// ── Sub-tabs inside the panel ────────────────────────────────

type SubTab =
  | 'roles'
  | 'candidates'
  | 'crew'
  | 'schedule'
  | 'publishing'
  | 'carousel'
  | 'approval'
  | 'brief'
  | 'planner'
  | 'shooting'
  | 'shotlist'
  | 'mannskap'
  | 'agent'
  | 'admin-room';

const ADMIN_ROOM_OWNER_EMAIL = 'daniel@creatorhubn.com';

// ── Props ────────────────────────────────────────────────────

interface RoleRoomDashboardPanelProps {
  userId: string;
  profession?: string;
  /** If provided, auto-links sync to this Creatorhub project */
  creatorhubProjectId?: string;
  workspaceSummary?: {
    companyName?: string | null;
    planName?: string | null;
    statusLabel?: string | null;
  } | null;
}

// ── Main component ──────────────────────────────────────────

const RoleRoomDashboardPanel: React.FC<RoleRoomDashboardPanelProps> = ({
  userId,
  profession,
  creatorhubProjectId,
  workspaceSummary,
}) => {
  // Auto-provision API key on first load
  useRoleRoomBootstrap(userId);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('roles');
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectEnablePostAgent, setNewProjectEnablePostAgent] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherAnchor, setSwitcherAnchor] = useState<HTMLElement | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxAnchor, setInboxAnchor] = useState<HTMLElement | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const [recentProjectIds, setRecentProjectIds] = useState<string[]>(() => readRecentProjects());
  const [restoredFromSession, setRestoredFromSession] = useState(false);
  const restoreAttemptedRef = useRef(false);

  const viewport = useRoleRoomViewportMode();
  const useTabRail = viewport.mode === 'tabletLandscape';
  const auth = useAuth();

  // Onboarding: sjekk om bruker må fullføre profil
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingMinimized, setOnboardingMinimized] = useState(false);
  const [memberProfileImageUrl, setMemberProfileImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!auth.user?.id) return;
    if (onboardingMinimized) return;
    let cancelled = false;
    void (async () => {
      try {
        const [status, profile] = await Promise.all([
          roleRoomMemberProfileService.getOnboardingStatus(),
          roleRoomMemberProfileService.getMyProfile().catch(() => null),
        ]);
        if (cancelled) return;
        if (status.requiresOnboarding) setOnboardingOpen(true);
        if (profile?.profileImageUrl) setMemberProfileImageUrl(profile.profileImageUrl);
      } catch (err) {
        console.warn('Onboarding status check failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [auth.user?.id, onboardingMinimized, onboardingOpen]);

  // Sentralt tab-katalog. Brukes av top-Tabs, side-rail og bottom-nav slik
  // at admin-konfigen virker likt på tvers av viewports.
  const TAB_DEFS: Record<SubTabValue, { label: string; Icon: any; highlight?: boolean }> = {
    'roles': { label: 'Roller', Icon: TheaterIcon },
    'candidates': { label: 'Kandidater', Icon: PersonIcon },
    'crew': { label: 'Crew', Icon: GroupIcon },
    'schedule': { label: 'Tidsplan', Icon: CalendarIcon },
    'publishing': { label: 'Publisering', Icon: YouTubeIcon },
    'carousel': { label: 'Ukescontent', Icon: EditIcon },
    'approval': { label: 'Godkjenning', Icon: CheckCircleIcon },
    'brief': { label: 'Brief', Icon: EditIcon },
    'planner': { label: 'Planner', Icon: ScheduleIcon },
    'shooting': { label: 'Skyting', Icon: MovieIcon },
    'shotlist': { label: 'Shotliste', Icon: TheaterIcon },
    'mannskap': { label: 'Mannskap', Icon: GroupIcon },
    'agent': { label: 'Agent', Icon: AutoFixHighIcon },
    'economy': { label: 'Økonomi', Icon: PaidIcon },
    'admin-room': { label: 'Admin Room', Icon: AutoFixHighIcon, highlight: true },
  };
  const isAdminUser = auth.user?.role === 'admin' || auth.user?.role === 'super_admin';
  const activeProfessionMode = getActiveProfessionMode();
  const [roleRoomAgentAccess, setRoleRoomAgentAccess] = useState<RoleRoomAgentAccess | null>(null);
  const [roleRoomAgentSnapshot, setRoleRoomAgentSnapshot] = useState<RoleRoomAgentProducerBootstrapResult | null>(null);

  // ── Queries ──────────────────────────────────────────────
  const {
    data: projects,
    isLoading: projectsLoading,
    refetch: refetchProjects,
  } = useRoleRoomProjects();

  const {
    data: selectedProject,
  } = useRoleRoomProject(selectedProjectId ?? undefined);

  const { data: castingRoles, isLoading: rolesLoading } = useCastingRoles(selectedProjectId ?? undefined);
  const { data: candidates, isLoading: candidatesLoading } = useCandidates(selectedProjectId ?? undefined);
  const { data: crew, isLoading: crewLoading } = useCrew(selectedProjectId ?? undefined);
  const { data: schedules, isLoading: schedulesLoading } = useSchedules(selectedProjectId ?? undefined);
  const { data: userRoles } = useProjectUserRoles(selectedProjectId ?? undefined);

  // ── Mutations ────────────────────────────────────────────
  const createProjectMut = useCreateProject();
  const deleteProjectMut = useDeleteProject();
  const syncProjectMut = useSyncProject();
  const createRoleMut = useCreateCastingRole();
  const addCandidateMut = useAddCandidate();
  const addCrewMut = useAddCrewMember();

  // ── Callbacks ────────────────────────────────────────────

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    const created = await createProjectMut.mutateAsync({
      name: newProjectName.trim(),
      description: newProjectDesc.trim() || undefined,
      creatorhubProjectId: creatorhubProjectId ?? undefined,
    });
    const createdId = (created as { id?: string })?.id ?? newProjectName.trim();
    roleRoomAnalytics.projectCreated({
      project_id: createdId,
      source: 'manual',
    });
    const wantsPostAgent = newProjectEnablePostAgent;
    setNewProjectName('');
    setNewProjectDesc('');
    setNewProjectEnablePostAgent(false);
    setNewProjectOpen(false);
    if (wantsPostAgent && typeof window !== 'undefined') {
      // Hand off to marketplace — production lead picks crew + confirms billing there.
      window.location.href = `/marketplace/post-agent?productionId=${encodeURIComponent(createdId)}`;
    }
  }, [newProjectName, newProjectDesc, newProjectEnablePostAgent, creatorhubProjectId, createProjectMut]);

  const handleSyncProject = useCallback(
    async (project: CastingProject) => {
      if (!creatorhubProjectId) return;
      await syncProjectMut.mutateAsync({
        creatorhubProjectId,
        projectName: project.name,
        projectType: project.project_type ?? undefined,
        description: project.description ?? undefined,
        userId,
      });
    },
    [creatorhubProjectId, userId, syncProjectMut]
  );

  const handleDeleteProject = useCallback(
    async (id: string) => {
      await deleteProjectMut.mutateAsync(id);
      if (selectedProjectId === id) setSelectedProjectId(null);
    },
    [selectedProjectId, deleteProjectMut]
  );

  // ── Quick stats ──────────────────────────────────────────
  const statsCards = useMemo(() => {
    const projectCount = projects?.length ?? 0;
    const roleCount = castingRoles?.length ?? 0;
    const candidateCount = candidates?.length ?? 0;
    const crewCount = crew?.length ?? 0;
    return [
      { label: 'Prosjekter', value: projectCount, icon: <FolderIcon />, color: '#6366f1' },
      { label: 'Roller', value: roleCount, icon: <TheaterIcon />, color: '#f59e0b' },
      { label: 'Kandidater', value: candidateCount, icon: <PersonIcon />, color: '#10b981' },
      { label: 'Crew', value: crewCount, icon: <GroupIcon />, color: '#ec4899' },
    ];
  }, [projects, castingRoles, candidates, crew]);

  const currentUserProjectRoles = useMemo(
    () => (userRoles ?? []).filter((entry) => entry.userId === userId),
    [userRoles, userId],
  );

  // Effektiv tab-rekkefølge for innlogget bruker (server-konfig + fallback til defaults).
  // Påvirker top-Tabs, iPad side-rail og telefon-bottom-nav likt.
  const userPrimaryRole = currentUserProjectRoles[0]?.role ?? null;
  const platformEffectiveTabs = useEffectiveTabsForRole(userPrimaryRole);

  // Project-spesifikk overstyring: team-leder kan styre hvilke tabs viewer
  // ser på dette prosjektet. Hvis tabValues=null → bruk platform-defaults.
  const [projectTabOverride, setProjectTabOverride] = useState<string[] | null>(null);
  useEffect(() => {
    if (!selectedProjectId) { setProjectTabOverride(null); return; }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/role-room/projects/${encodeURIComponent(selectedProjectId)}/my-tabs`,
          { credentials: 'include' },
        );
        if (!res.ok) return;
        const data = await res.json() as { tabValues: string[] | null };
        if (!cancelled) setProjectTabOverride(data.tabValues ?? null);
      } catch { /* fallback til defaults */ }
    })();
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  const effectiveTabs = useMemo(() => {
    if (projectTabOverride && projectTabOverride.length > 0) {
      return projectTabOverride.filter((t): t is SubTabValue =>
        platformEffectiveTabs.includes(t as SubTabValue) || true,
      ) as SubTabValue[];
    }
    return platformEffectiveTabs;
  }, [projectTabOverride, platformEffectiveTabs]);

  const canUsePublishing = useMemo(() => {
    const publishingRoles: UserRole['role'][] = [
      'producer',
      'content_producer',
      'director',
      'production_manager',
    ];

    if (currentUserProjectRoles.some((entry) => publishingRoles.includes(entry.role))) {
      return true;
    }

    return ['admin', 'enterprise', 'photographer', 'videographer', 'music_producer'].includes(profession ?? '');
  }, [currentUserProjectRoles, profession]);

  const publishingProjectId = selectedProject?.creatorhub_project_id ?? creatorhubProjectId ?? null;
  const publishingProjects = useMemo(() => (
    selectedProjectId
      ? [{
          id: publishingProjectId ?? selectedProjectId,
          name: selectedProject?.name ?? 'Prosjekt',
        }]
      : []
  ), [publishingProjectId, selectedProject?.name, selectedProjectId]);

  useEffect(() => {
    let cancelled = false;

    void roleRoomAgentService
      .getAccess()
      .then((access) => {
        if (!cancelled) {
          setRoleRoomAgentAccess(access);
        }
      })
      .catch((error) => {
        console.warn('[RoleRoomDashboardPanel] Could not load Role Room Agent access for publishing', error);
        if (!cancelled) {
          setRoleRoomAgentAccess(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const canUseAgentSnapshot = Boolean(roleRoomAgentAccess?.allowed && roleRoomAgentAccess?.isAdmin);

    if (!selectedProjectId || !canUseAgentSnapshot) {
      setRoleRoomAgentSnapshot(null);
      return () => {
        cancelled = true;
      };
    }

    void roleRoomAgentService
      .getSnapshot(selectedProjectId)
      .then((snapshot) => {
        if (!cancelled) {
          setRoleRoomAgentSnapshot(snapshot);
        }
      })
      .catch((error) => {
        console.warn('[RoleRoomDashboardPanel] Could not load Role Room Agent snapshot for publishing', error);
        if (!cancelled) {
          setRoleRoomAgentSnapshot(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [roleRoomAgentAccess?.allowed, roleRoomAgentAccess?.isAdmin, selectedProjectId]);

  const roleRoomPublishingSuggestion = useMemo(
    () => (
      roleRoomAgentAccess?.allowed && roleRoomAgentAccess?.isAdmin
        ? buildRoleRoomPublishingSuggestion(selectedProject?.name, roleRoomAgentSnapshot)
        : null
    ),
    [roleRoomAgentAccess?.allowed, roleRoomAgentAccess?.isAdmin, roleRoomAgentSnapshot, selectedProject?.name],
  );

  const mobileSyncStatus: MobileSyncStatus = useMemo(() => {
    if (syncProjectMut.isPending) return 'syncing';
    if (syncProjectMut.isError) return 'error';
    if (syncProjectMut.isSuccess) return 'success';
    return 'idle';
  }, [syncProjectMut.isPending, syncProjectMut.isError, syncProjectMut.isSuccess]);

  const activeRoleLabel = useMemo(() => {
    const role = currentUserProjectRoles[0]?.role;
    if (!role) return null;
    const spaced = String(role).replace(/_/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }, [currentUserProjectRoles]);

  // Item 042/366: restore last workspace once, after projects load. Ignore demo
  // projects and only restore if the stored id still exists in the project list.
  useEffect(() => {
    if (restoreAttemptedRef.current) return;
    if (!projects || projects.length === 0) return;
    restoreAttemptedRef.current = true;

    if (selectedProjectId) return;
    const last = readLastWorkspace();
    if (!last) return;
    const stillExists = projects.some((p) => p.id === last.projectId);
    if (!stillExists) return;

    setSelectedProjectId(last.projectId);
    if (last.subTab) {
      setSubTab(last.subTab as SubTab);
    }
    setRestoredFromSession(true);
  }, [projects, selectedProjectId]);

  // Persist last workspace + maintain recents list on every real selection.
  useEffect(() => {
    if (!selectedProjectId) return;
    saveLastWorkspace(selectedProjectId, subTab);
    setRecentProjectIds((prev) => {
      const filtered = prev.filter((id) => id !== selectedProjectId);
      return [selectedProjectId, ...filtered].slice(0, 3);
    });
    // Writing-through to localStorage; the returned list is identical shape.
    pushRecentProject(selectedProjectId);
  }, [selectedProjectId, subTab]);

  // Inbox: producer notifications scoped to the active project.
  const {
    items: rawNotifications,
    loading: inboxLoading,
    error: inboxErrorRaw,
    unreadCount: inboxUnreadCount,
    markAsRead: markNotificationAsRead,
  } = useProducerNotifications(selectedProjectId ?? undefined);

  const inboxItems: InboxItem[] = useMemo(
    () =>
      (rawNotifications ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        read: Boolean(n.read),
        createdAt: n.created_at,
        eventType: n.event_type,
      })),
    [rawNotifications],
  );

  const handleOpenSwitcher = useCallback((anchor: HTMLElement) => {
    setSwitcherAnchor(anchor);
    setSwitcherOpen(true);
  }, []);

  const handleCloseSwitcher = useCallback(() => {
    setSwitcherOpen(false);
  }, []);

  const handleSelectFromSwitcher = useCallback((id: string) => {
    setSelectedProjectId(id);
    setRestoredFromSession(false);
  }, []);

  const handleOpenInbox = useCallback((anchor: HTMLElement) => {
    setInboxAnchor(anchor);
    setInboxOpen(true);
  }, []);

  const handleCloseInbox = useCallback(() => setInboxOpen(false), []);

  const handleInboxItemClick = useCallback(
    (id: string) => {
      void markNotificationAsRead(id).catch(() => {
        /* swallow — surfacing mark-read errors is out of scope for fase 2 */
      });
    },
    [markNotificationAsRead],
  );

  const handleOpenProfile = useCallback((anchor: HTMLElement) => {
    setProfileAnchor(anchor);
    setProfileOpen(true);
  }, []);

  const handleCloseProfile = useCallback(() => setProfileOpen(false), []);

  const profileDisplayName = auth.user?.displayName || auth.user?.name || null;
  const profileEmail = auth.user?.email || null;
  const profileInitials = useMemo(() => {
    const source = (profileDisplayName ?? profileEmail ?? '').trim();
    if (!source) return null;
    const parts = source.split(/\s+/);
    if (parts.length === 1) return source.slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [profileDisplayName, profileEmail]);

  // ── Render ───────────────────────────────────────────────

  if (projectsLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={120} sx={{ mb: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (isDanceMode(activeProfessionMode)) {
    return (
      <Box className="role-room-route role-room-route--dance" sx={{ position: 'relative', minHeight: '100vh' }}>
        <DanceWorkspace projectId={selectedProjectId ?? undefined} />
        <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1200 }}>
          <Tooltip title="Profil">
            <IconButton
              onClick={(event) => handleOpenProfile(event.currentTarget)}
              aria-label="Åpne profil"
              sx={{
                bgcolor: 'rgba(139,92,246,0.95)',
                color: '#fff',
                boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
                '&:hover': { bgcolor: 'rgba(124,58,237,1)' },
              }}
            >
              {memberProfileImageUrl ? (
                <Avatar src={memberProfileImageUrl} sx={{ width: 28, height: 28 }} />
              ) : profileInitials ? (
                <Avatar sx={{ width: 28, height: 28, bgcolor: 'transparent', fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>
                  {profileInitials}
                </Avatar>
              ) : (
                <AccountCircleIcon />
              )}
            </IconButton>
          </Tooltip>
        </Box>
        <RoleRoomMobileProfileSheet
          open={profileOpen}
          onClose={handleCloseProfile}
          mode={viewport.mode}
          anchorEl={profileAnchor}
          displayName={profileDisplayName}
          email={profileEmail}
          roleLabel={activeRoleLabel}
          workspaceSummary={workspaceSummary ?? null}
          onLogout={auth.logout ? () => { void auth.logout(); } : undefined}
          isAdmin={isAdminUser}
        />
      </Box>
    );
  }

  return (
    <Box
      className="role-room-route"
      sx={{
        p: { xs: 1, sm: 2, md: 3 },
        maxWidth: 1400,
        mx: 'auto',
        pb: viewport.mode === 'mobile'
          ? 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)'
          : undefined,
      }}
    >
      {/* ── Mobile/iPad topbar (items 026-050) ─────────── */}
      {!viewport.isDesktop ? (
        <>
          <RoleRoomMobileTopBar
            projectName={selectedProject?.name ?? null}
            projectCount={projects?.length ?? 0}
            activeRoleLabel={activeRoleLabel}
            syncStatus={mobileSyncStatus}
            onOpenProjectSwitcher={handleOpenSwitcher}
            onRefresh={() => refetchProjects()}
            onCreateProject={() => setNewProjectOpen(true)}
            restoredFromSession={restoredFromSession}
            onDismissRestoredChip={() => setRestoredFromSession(false)}
            onOpenInbox={handleOpenInbox}
            inboxUnreadCount={inboxUnreadCount ?? 0}
            onOpenProfile={handleOpenProfile}
            profileInitials={profileInitials}
            profileImageUrl={memberProfileImageUrl}
          />
          <RoleRoomProjectSwitcher
            open={switcherOpen}
            onClose={handleCloseSwitcher}
            mode={viewport.mode}
            anchorEl={switcherAnchor}
            projects={projects ?? []}
            selectedProjectId={selectedProjectId}
            onSelect={handleSelectFromSwitcher}
            recentProjectIds={recentProjectIds}
          />
          <RoleRoomMobileInboxSheet
            open={inboxOpen}
            onClose={handleCloseInbox}
            mode={viewport.mode}
            items={inboxItems}
            loading={inboxLoading}
            error={inboxErrorRaw}
            onItemClick={handleInboxItemClick}
          />
        </>
      ) : null}

      {/* ── Desktop header ─────────────────────────────── */}
      <Box sx={{ display: viewport.isDesktop ? 'flex' : 'none', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RoleRoomBrandMark appearance="header" showLabel={false} />
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Casting, crew & produksjonsplanlegging
          </Typography>
          {(workspaceSummary?.planName || workspaceSummary?.companyName || workspaceSummary?.statusLabel) ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.1 }}>
              {workspaceSummary?.statusLabel ? (
                <Chip
                  size="small"
                  label={workspaceSummary.statusLabel}
                  sx={{
                    bgcolor: 'rgba(124,58,237,0.12)',
                    color: '#6d28d9',
                    fontWeight: 700,
                  }}
                />
              ) : null}
              {workspaceSummary?.planName ? (
                <Chip
                  size="small"
                  label={workspaceSummary.planName}
                  variant="outlined"
                  sx={{
                    borderColor: 'rgba(124,58,237,0.25)',
                    color: 'rgba(17,24,39,0.82)',
                    fontWeight: 600,
                  }}
                />
              ) : null}
              {workspaceSummary?.companyName ? (
                <Chip
                  size="small"
                  label={workspaceSummary.companyName}
                  variant="outlined"
                  sx={{
                    borderColor: 'rgba(14,165,233,0.25)',
                    color: 'rgba(17,24,39,0.72)',
                  }}
                />
              ) : null}
            </Stack>
          ) : null}
          <Box sx={{ mt: 1.2 }}>
            <GoogleWorkspaceSessionBadge
              userId={userId}
              tone="role-room"
            />
          </Box>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Oppdater">
            <IconButton onClick={() => refetchProjects()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setNewProjectOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Nytt prosjekt
          </Button>
          <Tooltip title="Profil">
            <IconButton
              onClick={(event) => handleOpenProfile(event.currentTarget)}
              sx={{ ml: 0.5 }}
              aria-label="Åpne profil"
            >
              {memberProfileImageUrl ? (
                <Avatar src={memberProfileImageUrl} sx={{ width: 32, height: 32 }} />
              ) : profileInitials ? (
                <Avatar sx={{ width: 32, height: 32, bgcolor: '#6366f1', fontSize: '0.85rem', fontWeight: 700 }}>
                  {profileInitials}
                </Avatar>
              ) : (
                <AccountCircleIcon />
              )}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <PostAgentErrorBoundary label="Velkomst-banner">
        <PostAgentCrewWelcomeBanner />
      </PostAgentErrorBoundary>

      {/* ── Stats Row ──────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statsCards.map((s) => (
          <Grid key={s.label} size={{ xs: 6, sm: 3 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Avatar sx={{ bgcolor: s.color, width: 40, height: 40 }}>{s.icon}</Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* ── Projects list ──────────────────────────────── */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardHeader
              title="Prosjekter"
              titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
              avatar={<MovieIcon fontSize="small" sx={{ color: '#6366f1' }} />}
            />
            <Divider />
            {!projects?.length ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Ingen prosjekter ennå
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {projects.map((p) => (
                  <ListItem
                    key={p.id}
                    component="div"
                    onClick={() => setSelectedProjectId(p.id)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: selectedProjectId === p.id ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <ListItemText
                      primary={p.name}
                      secondary={
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                          <Chip
                            label={p.status ?? 'draft'}
                            size="small"
                            color={statusColor(p.status ?? 'draft')}
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                          {p.creatorhub_project_id && (
                            <Chip
                              icon={<LinkIcon sx={{ fontSize: 14 }} />}
                              label="Synced"
                              size="small"
                              color="info"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Slett">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(p.id);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Card>
        </Grid>

        {/* ── Detail panel ─────────────────────────────── */}
        <Grid size={{ xs: 12, md: 8 }}>
          {!selectedProjectId ? (
            <Card
              variant="outlined"
              sx={{
                borderRadius: 2,
                height: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <TheaterIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">Velg et prosjekt fra listen</Typography>
              </Box>
            </Card>
          ) : (
            <Box
              sx={{
                display: useTabRail ? 'flex' : 'block',
                gap: useTabRail ? 1.5 : 0,
                alignItems: 'flex-start',
              }}
            >
              {useTabRail && (
                <RoleRoomTabRail
                  visible
                  value={subTab}
                  onChange={(next) => {
                    roleRoomAnalytics.tabChanged({
                      project_id: selectedProjectId ?? undefined,
                      tab_id: String(next),
                      from_tab: String(subTab),
                    });
                    setSubTab(next as SubTab);
                  }}
                  ariaLabel="Prosjekt-seksjoner"
                  items={effectiveTabs
                    .filter((v) => {
                      // Skjul faner som krever en gate som ikke er åpen
                      if (v === 'publishing' && !canUsePublishing) return false;
                      if (v === 'admin-room' && (profileEmail || '').trim().toLowerCase() !== ADMIN_ROOM_OWNER_EMAIL) return false;
                      return Boolean(TAB_DEFS[v]);
                    })
                    .map((v) => ({
                      value: v,
                      label: TAB_DEFS[v].label,
                      Icon: TAB_DEFS[v].Icon,
                      highlight: TAB_DEFS[v].highlight,
                    }))}
                />
              )}
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  flex: useTabRail ? 1 : undefined,
                  minWidth: 0,
                  width: useTabRail ? undefined : '100%',
                }}
              >
              {/* Project header */}
              <CardHeader
                title={selectedProject?.name ?? '…'}
                subheader={selectedProject?.description}
                action={
                  creatorhubProjectId ? (
                    <Tooltip title="Synkroniser med Creatorhub">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<SyncIcon />}
                        disabled={syncProjectMut.isPending}
                        onClick={() => selectedProject && handleSyncProject(selectedProject)}
                        sx={{ mr: 1, mt: 1 }}
                      >
                        Sync
                      </Button>
                    </Tooltip>
                  ) : null
                }
              />

              {isProductionMode(activeProfessionMode) && (
                <Box sx={{ px: 2 }}>
                  <GrantedAssetsCard />
                </Box>
              )}

              {isProductionMode(activeProfessionMode) && selectedProjectId && (
                <Box sx={{ px: 2 }}>
                  <PostAgentErrorBoundary label="Post Agent-status">
                    <PostAgentReadyCard projectId={selectedProjectId} />
                  </PostAgentErrorBoundary>
                </Box>
              )}

              {syncProjectMut.isPending && <LinearProgress />}
              {syncProjectMut.isSuccess && (
                <Alert severity="success" sx={{ mx: 2 }}>
                  Prosjektet ble synkronisert
                </Alert>
              )}

              {/* Sub-tabs (hidden on iPad landscape — rail handles nav) */}
              {!useTabRail && (<>
              <Tabs
                value={subTab}
                onChange={(_, v: SubTab) => {
                  roleRoomAnalytics.tabChanged({
                    project_id: selectedProjectId ?? undefined,
                    tab_id: String(v),
                    from_tab: String(subTab),
                  });
                  setSubTab(v);
                }}
                className="rr-sub-tabs"
                sx={{
                  px: { xs: 1, sm: 2 },
                  minHeight: { xs: 56, sm: 48 },
                  '& .MuiTab-root': {
                    minHeight: { xs: 56, sm: 48 },
                    minWidth: { xs: 96, sm: 90 },
                    fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                    px: { xs: 1.5, sm: 2 },
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                    '&:active': { bgcolor: 'rgba(139,92,246,0.08)' },
                  },
                  '& .MuiTabs-scrollButtons.Mui-disabled': {
                    opacity: 0.3,
                  },
                  '& .MuiTabs-indicator': {
                    height: 3,
                  },
                }}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
              >
                {effectiveTabs
                  .filter((v) => {
                    if (v === 'publishing' && !canUsePublishing) return false;
                    if (v === 'admin-room' && (profileEmail || '').trim().toLowerCase() !== ADMIN_ROOM_OWNER_EMAIL) return false;
                    return Boolean(TAB_DEFS[v]);
                  })
                  .map((v) => {
                    const def = TAB_DEFS[v];
                    const TabIconComp = def.Icon;
                    return (
                      <Tab
                        key={v}
                        value={v}
                        label={def.label}
                        icon={<TabIconComp fontSize="small" />}
                        iconPosition="start"
                        sx={def.highlight ? { minHeight: 48, color: '#a78bfa' } : { minHeight: 48 }}
                      />
                    );
                  })}
              </Tabs>
              <Divider />
              </>)}

              <CardContent sx={{ minHeight: 300 }}>
                {subTab === 'roles' && (
                  <RolesSubPanel
                    projectId={selectedProjectId}
                    roles={castingRoles ?? []}
                    loading={rolesLoading}
                    onCreate={createRoleMut}
                  />
                )}
                {subTab === 'candidates' && (
                  <CandidatesSubPanel
                    projectId={selectedProjectId}
                    candidates={candidates ?? []}
                    loading={candidatesLoading}
                    onAdd={addCandidateMut}
                  />
                )}
                {subTab === 'crew' && (
                  <CrewSubPanel
                    projectId={selectedProjectId}
                    crew={crew ?? []}
                    loading={crewLoading}
                    onAdd={addCrewMut}
                    isProjectLeader={!!selectedProject?.createdBy && selectedProject.createdBy === auth.user?.id}
                  />
                )}
                {subTab === 'schedule' && (
                  <ScheduleSubPanel
                    schedules={schedules ?? []}
                    loading={schedulesLoading}
                  />
                )}
                {subTab === 'publishing' && canUsePublishing && (
                  <Box sx={{ display: 'grid', gap: 2 }}>
                    {!publishingProjectId && (
                      <Alert severity="info" variant="outlined">
                        YouTube-publisering virker nå i The Role Room, men dette prosjektet er ikke koblet til et CreatorHub-prosjekt ennå.
                        Du kan fortsatt laste opp og redigere videoer, men showcase-sync aktiveres først når prosjektet er synket.
                      </Alert>
                    )}
                    <YouTubeIntegration
                      userId={userId}
                      projectId={publishingProjectId}
                      projects={publishingProjects}
                      selectedProjectId={publishingProjectId}
                      brandVariant="role-room"
                      publishingSuggestion={roleRoomPublishingSuggestion}
                      compact
                      createShowcaseOnUpload={Boolean(publishingProjectId)}
                    />
                  </Box>
                )}
                {subTab === 'approval' && !viewport.isDesktop && (
                  <RoleRoomMobileApprovalView
                    projectId={selectedProjectId}
                    currentUserId={userId}
                    mode={viewport.mode}
                    canApprove={Boolean(selectedProjectId)}
                    canRequestChanges={Boolean(selectedProjectId)}
                    canReject={Boolean(selectedProjectId)}
                    canComment={Boolean(selectedProjectId)}
                  />
                )}
                {subTab === 'brief' && !viewport.isDesktop && (
                  <RoleRoomMobileBriefWizard projectId={selectedProjectId} mode={viewport.mode} />
                )}
                {subTab === 'planner' && !viewport.isDesktop && (
                  <RoleRoomMobilePlannerView
                    projectId={selectedProjectId}
                    mode={viewport.mode}
                  />
                )}
                {subTab === 'shooting' && !viewport.isDesktop && (
                  <RoleRoomMobileShootingDayView
                    projectId={selectedProjectId}
                    mode={viewport.mode}
                  />
                )}
                {subTab === 'shotlist' && !viewport.isDesktop && (
                  <RoleRoomMobileShotListView
                    projectId={selectedProjectId}
                    mode={viewport.mode}
                  />
                )}
                {subTab === 'mannskap' && !viewport.isDesktop && (
                  <RoleRoomMobileCrewView
                    projectId={selectedProjectId}
                    mode={viewport.mode}
                  />
                )}
                {subTab === 'agent' && (
                  <AgentChatMount
                    projectId={selectedProjectId}
                    currentUserId={userId}
                    candidates={candidates as any}
                    crew={crew as any}
                  />
                )}
                {subTab === 'carousel' && (
                  <CarouselPanel projectId={selectedProjectId} />
                )}
                {subTab === 'economy' && (
                  <ClientEconomyPanel projectId={selectedProjectId} userRole={auth.user?.role ?? null} />
                )}
                {subTab === 'admin-room'
                  && (profileEmail || '').trim().toLowerCase() === ADMIN_ROOM_OWNER_EMAIL && (
                    <AdminRoom />
                )}
              </CardContent>
              </Card>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* ── New project dialog ─────────────────────────── */}
      <Dialog open={newProjectOpen} onClose={() => setNewProjectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nytt casting-prosjekt</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Prosjektnavn"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            label="Beskrivelse"
            value={newProjectDesc}
            onChange={(e) => setNewProjectDesc(e.target.value)}
            multiline
            rows={3}
            fullWidth
          />
          {isProductionMode(activeProfessionMode) && (
            <Box
              sx={{
                mt: 1,
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
              }}
            >
              <Checkbox
                size="small"
                checked={newProjectEnablePostAgent}
                onChange={(e) => setNewProjectEnablePostAgent(e.target.checked)}
                sx={{ p: 0.25, mt: 0.25 }}
              />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Aktiver Post Agent for prosjektet
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  AI-drevet post-produksjon i DaVinci Resolve. Du velger crew + bekrefter betaling
                  på neste skjerm. 299 NOK/seat/mnd.
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewProjectOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleCreateProject}
            disabled={!newProjectName.trim() || createProjectMut.isPending}
          >
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      {/* Profil-sheet (også på desktop) — admin-only modus-switcher er innebygget. */}
      <RoleRoomMobileProfileSheet
        open={profileOpen}
        onClose={handleCloseProfile}
        mode={viewport.mode}
        anchorEl={profileAnchor}
        displayName={profileDisplayName}
        email={profileEmail}
        roleLabel={activeRoleLabel}
        workspaceSummary={workspaceSummary ?? null}
        onLogout={auth.logout ? () => { void auth.logout(); } : undefined}
        isAdmin={isAdminUser}
      />

      {/* Telefon-bunn-nav: server-konfig + filter på sikre gates (publishing/admin) */}
      {viewport.mode === 'mobile' && selectedProjectId && (() => {
        const allowed = effectiveTabs.filter((v) => {
          if (v === 'publishing' && !canUsePublishing) return false;
          if (v === 'admin-room' && (profileEmail || '').trim().toLowerCase() !== ADMIN_ROOM_OWNER_EMAIL) return false;
          return Boolean(TAB_DEFS[v]);
        });
        const items: BottomNavItem[] = allowed.map((v) => ({
          value: v,
          label: TAB_DEFS[v].label,
          Icon: TAB_DEFS[v].Icon,
        }));
        const primaryItems = items.slice(0, 4);
        const overflowItems = items.slice(4);
        return (
          <RoleRoomBottomNav
            visible
            primaryItems={primaryItems}
            overflowItems={overflowItems}
            value={subTab}
            onChange={(next) => {
              roleRoomAnalytics.tabChanged({
                project_id: selectedProjectId ?? undefined,
                tab_id: String(next),
                from_tab: String(subTab),
              });
              setSubTab(next as SubTab);
            }}
          />
        );
      })()}

      {/* First-time onboarding-flow for ALL Role Room-members */}
      <RoleRoomOnboardingDialog
        open={onboardingOpen}
        onComplete={() => setOnboardingOpen(false)}
        onMinimize={() => {
          setOnboardingOpen(false);
          setOnboardingMinimized(true);
        }}
      />
    </Box>
  );
};

export default RoleRoomDashboardPanel;

// ── Agent chat mount ──────────────────────────────────────────
// Separate component so hooks (useRoleRoomAgentContext + the write
// mutations) are only run when the Agent subtab is active. Without this,
// every Role Room render would trigger producer-review + timeline fetches
// even if the user never opens the agent.

interface AgentChatMountProps {
  projectId: string | null;
  currentUserId: string;
  candidates?: any[];
  crew?: any[];
}

const AgentChatMount: React.FC<AgentChatMountProps> = ({
  projectId,
  currentUserId,
  candidates,
  crew,
}) => {
  const context = useRoleRoomAgentContext({ projectId, candidates, crew });
  const { createReview } = useProducerReviews(projectId ?? undefined);
  const { createItem } = useProducerTimeline(projectId ?? undefined);

  const handleConfirmToolUse = React.useCallback(
    async (tool: { name: string; input: Record<string, any>; id?: string }): Promise<string | void> => {
      if (!projectId) return;

      // Validate first — agent occasionally returns enums outside the
      // declared set (e.g. review_type "custom"). The backend write
      // endpoints don't re-validate, so we'd silently persist garbage.
      const validation = validateAgentToolInput(tool.name, tool.input ?? {});
      if (!validation.ok) {
        const message = `Agentens forslag har ugyldig input:\n${validation.errors.join('\n')}`;
        void logAgentToolResult({
          projectId,
          toolName: tool.name,
          toolUseId: tool.id,
          status: 'invalid_input',
          errorMessage: message,
        });
        throw new Error(message);
      }

      try {
        switch (tool.name) {
          case 'draft_review_request': {
            const input = validation.data as {
              review_type: string;
              title: string;
              description?: string;
              target_entity_type?: string;
              target_entity_id?: string;
              suggested_due_days_from_now?: number;
            };
            const dueAt = input.suggested_due_days_from_now !== undefined
              ? new Date(Date.now() + input.suggested_due_days_from_now * 24 * 60 * 60 * 1000).toISOString()
              : undefined;
            await createReview({
              review_type: input.review_type,
              title: input.title,
              description: input.description,
              target_entity_type: input.target_entity_type,
              target_entity_id: input.target_entity_id,
              due_at: dueAt,
            } as any);
            void logAgentToolResult({
              projectId,
              toolName: tool.name,
              toolUseId: tool.id,
              status: 'ok',
            });
            return `Opprettet review «${input.title}» (${input.review_type}).`;
          }
          case 'propose_timeline_item': {
            const input = validation.data as {
              phase: 'preproduction' | 'production' | 'postproduction';
              entry_type: string;
              title: string;
              description?: string;
              suggested_due_days_from_now?: number;
              rationale: string;
            };
            const dueAt = input.suggested_due_days_from_now !== undefined
              ? new Date(Date.now() + input.suggested_due_days_from_now * 24 * 60 * 60 * 1000).toISOString()
              : undefined;
            await createItem({
              phase: input.phase as any,
              title: input.title,
              description: input.description,
              dueAt,
              status: 'planned',
              metadata: {
                entryType: input.entry_type,
                agentRationale: input.rationale,
              },
            });
            void logAgentToolResult({
              projectId,
              toolName: tool.name,
              toolUseId: tool.id,
              status: 'ok',
            });
            return `La til timeline-oppgave «${input.title}» i ${input.phase}.`;
          }
          default:
            // summarize_brief_gaps / flag_scope_impact / suggest_next_decision are
            // read-only; their input is the "answer" and needs no write.
            void logAgentToolResult({
              projectId,
              toolName: tool.name,
              toolUseId: tool.id,
              status: 'ok',
            });
            return;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void logAgentToolResult({
          projectId,
          toolName: tool.name,
          toolUseId: tool.id,
          status: 'error',
          errorMessage: message,
        });
        throw err;
      }
    },
    [projectId, createReview, createItem],
  );

  return (
    <RoleRoomAgentChatPanel
      projectId={projectId}
      currentUserId={currentUserId}
      context={context}
      onConfirmToolUse={handleConfirmToolUse}
    />
  );
};

// ── Sub-panels ───────────────────────────────────────────────

function RolesSubPanel({
  projectId,
  roles,
  loading,
  onCreate,
}: {
  projectId: string;
  roles: CastingRole[];
  loading: boolean;
  onCreate: ReturnType<typeof useCreateCastingRole>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  if (loading) return <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Casting-roller ({roles.length})
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Legg til
        </Button>
      </Box>

      {roles.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Ingen roller definert ennå
        </Typography>
      ) : (
        <List dense>
          {roles.map((r) => (
            <ListItem key={r.id}>
              <Avatar sx={{ mr: 1.5, bgcolor: '#f59e0b', width: 32, height: 32 }}>
                <TheaterIcon fontSize="small" />
              </Avatar>
              <ListItemText
                primary={r.name}
                secondary={[r.role_type, r.age_range, r.gender].filter(Boolean).join(' · ')}
              />
              <Chip label={r.status ?? 'open'} size="small" color={r.status === 'filled' ? 'success' : 'default'} />
            </ListItem>
          ))}
        </List>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Ny rolle</DialogTitle>
        <DialogContent>
          <TextField
            label="Rollenavn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={!name.trim() || onCreate.isPending}
            onClick={async () => {
              const created = await onCreate.mutateAsync({ projectId, data: { name: name.trim() } });
              roleRoomAnalytics.roleCreated({
                project_id: projectId,
                role_id: (created as { id?: string })?.id ?? name.trim(),
              });
              setName('');
              setOpen(false);
            }}
          >
            Opprett
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function CandidatesSubPanel({
  projectId,
  candidates,
  loading,
  onAdd,
}: {
  projectId: string;
  candidates: Candidate[];
  loading: boolean;
  onAdd: ReturnType<typeof useAddCandidate>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  if (loading) return <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Kandidater ({candidates.length})
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Legg til
        </Button>
      </Box>

      {candidates.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Ingen kandidater lagt til ennå
        </Typography>
      ) : (
        <List dense>
          {candidates.map((c) => (
            <ListItem key={c.id}>
              <Avatar sx={{ mr: 1.5, bgcolor: '#10b981', width: 32, height: 32 }}>
                <PersonIcon fontSize="small" />
              </Avatar>
              <ListItemText primary={c.name} secondary={c.email ?? c.agency ?? ''} />
              <Chip
                label={c.status ?? 'pending'}
                size="small"
                color={c.status === 'accepted' ? 'success' : c.status === 'rejected' ? 'error' : 'default'}
              />
            </ListItem>
          ))}
        </List>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Ny kandidat</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Navn" value={name} onChange={(e) => setName(e.target.value)} fullWidth autoFocus />
          <TextField label="E-post" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={!name.trim() || onAdd.isPending}
            onClick={async () => {
              const created = await onAdd.mutateAsync({ projectId, data: { name: name.trim(), email: email.trim() || undefined } });
              roleRoomAnalytics.candidateAdded({
                project_id: projectId,
                role_id: (created as { roleId?: string; id?: string })?.roleId ?? 'unassigned',
                source: 'manual',
              });
              setName('');
              setEmail('');
              setOpen(false);
            }}
          >
            Legg til
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function CrewSubPanel({
  projectId,
  crew,
  loading,
  onAdd,
  isProjectLeader,
}: {
  projectId: string;
  crew: CrewMember[];
  loading: boolean;
  onAdd: ReturnType<typeof useAddCrewMember>;
  isProjectLeader?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [tabAccessOpen, setTabAccessOpen] = useState(false);
  const [seatConfirmOpen, setSeatConfirmOpen] = useState(false);
  const [seatUpgrading, setSeatUpgrading] = useState(false);
  const [seatUpgradeError, setSeatUpgradeError] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const qc = useQueryClient();

  // Seat-status: hvor mange seats er brukt vs. inkludert i abonnementet
  const seatStatusQuery = useQuery({
    queryKey: ['role-room-seat-status', projectId],
    queryFn: () => roleRoomProjectTabConfigService.getSeatStatus(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
    retry: 1,
  });
  const seatStatus = seatStatusQuery.data;

  // Seats granted on this project, keyed by user email (for matching crew rows by email)
  const seatsQuery = useQuery<{ seats: Array<{ userId: string; email?: string; isActive?: boolean }> }>({
    queryKey: ['post-agent-team-seats', projectId],
    queryFn: async () => {
      const res = await apiRequest(`/api/post-agent/team/${projectId}/seats`).catch(() => null);
      const data = (res as any)?.json ? await (res as any).json() : res;
      return { seats: Array.isArray(data?.seats) ? data.seats : [] };
    },
    enabled: !!projectId,
    staleTime: 30_000,
    retry: 1,
  });

  const activeSeats = (seatsQuery.data?.seats || []).filter((s) => s.isActive !== false);
  const seatByEmail = new Map<string, { userId: string }>();
  const seatByUserId = new Map<string, true>();
  activeSeats.forEach((s) => {
    if (s.email) seatByEmail.set(s.email.toLowerCase(), { userId: s.userId });
    if (s.userId) seatByUserId.set(s.userId, true);
  });

  const grantMut = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest(`/api/post-agent/team/${projectId}/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return (res as any)?.json ? await (res as any).json() : res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post-agent-team-seats', projectId] });
      qc.invalidateQueries({ queryKey: ['post-agent-card', projectId, 'seats'] });
    },
  });

  const revokeMut = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest(`/api/post-agent/team/${projectId}/grant/${userId}`, { method: 'DELETE' });
      return (res as any)?.json ? await (res as any).json() : res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post-agent-team-seats', projectId] });
      qc.invalidateQueries({ queryKey: ['post-agent-card', projectId, 'seats'] });
    },
  });

  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ rowId: string; msg: string; cta?: { label: string; url: string } } | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleBulkGrant() {
    const unseated = crew.filter((c) => {
      const email = c.email?.trim().toLowerCase();
      return !!email && !seatByEmail.get(email);
    });
    if (unseated.length === 0) return;
    setBulkProgress({ done: 0, total: unseated.length });
    setRowError(null);
    for (let i = 0; i < unseated.length; i++) {
      try {
        await grantMut.mutateAsync(unseated[i].email!);
      } catch {
        /* skip — error chips per row would be noisy in bulk; continue */
      }
      setBulkProgress({ done: i + 1, total: unseated.length });
    }
    setBulkProgress(null);
  }

  async function handleToggle(c: CrewMember, currentSeat: { userId: string } | undefined) {
    if (!c.email) return;
    setBusyRow(c.id);
    setRowError(null);
    try {
      if (currentSeat) {
        await revokeMut.mutateAsync(currentSeat.userId);
      } else {
        const result = await grantMut.mutateAsync(c.email);
        if (result?.error === 'owner_subscription_required') {
          setRowError({
            rowId: c.id,
            msg: 'Du må ha et aktivt Role Room-abonnement eller kjøpe Post Agent standalone.',
            cta: { label: 'Sett opp billing', url: `/marketplace/post-agent?productionId=${encodeURIComponent(projectId)}` },
          });
        } else if (result?.error) {
          setRowError({ rowId: c.id, msg: result.detail || result.error });
        }
      }
    } catch (e: any) {
      setRowError({ rowId: c.id, msg: e?.message || 'Noe gikk galt' });
    } finally {
      setBusyRow(null);
    }
  }

  if (loading) return <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Crew ({crew.length})
        </Typography>
        <Stack direction="row" spacing={1}>
          {isProjectLeader && (
            <Button size="small" startIcon={<GroupIcon />} onClick={() => setMembersOpen(true)}
                    sx={{ color: '#6d28d9' }}>
              Medlemmer
            </Button>
          )}
          {isProjectLeader && (
            <Button size="small" startIcon={<TuneIcon />} onClick={() => setTabAccessOpen(true)}
                    sx={{ color: '#6d28d9' }}>
              Tab-tilganger
            </Button>
          )}
          <Button size="small" startIcon={<AddIcon />}
                  onClick={() => {
                    if (isProjectLeader && seatStatus?.nextSeatNeedsBilling) {
                      setSeatConfirmOpen(true);
                    } else {
                      setOpen(true);
                    }
                  }}>
            Legg til
          </Button>
        </Stack>
      </Box>

      {/* Seat-status: leder ser hvor mange seats abonnementet dekker.
          Vises kun for leder for å unngå støy for crew-medlemmer. */}
      {isProjectLeader && seatStatus && seatStatus.hasActiveSubscription && (
        <Alert
          severity={seatStatus.extraSeats > 0 ? 'warning' : seatStatus.nextSeatNeedsBilling ? 'info' : 'success'}
          variant="outlined"
          sx={{ mb: 2 }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {seatStatus.usedSeats} av {seatStatus.includedSeats} seats brukt
            {seatStatus.extraSeats > 0 && ` (+${seatStatus.extraSeats} ekstra)`}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            {seatStatus.extraSeats > 0
              ? `Du betaler ${seatStatus.extraCostPerMonth} kr/mnd ekstra for seats utover de ${seatStatus.includedSeats} inkluderte.`
              : seatStatus.nextSeatNeedsBilling
                ? `Neste seat koster ${seatStatus.nextSeatCost} kr/mnd ekstra.`
                : `Du har ${seatStatus.includedSeats - seatStatus.usedSeats} ledige seats igjen på abonnementet.`}
          </Typography>
        </Alert>
      )}

      {isProjectLeader && tabAccessOpen && (
        <ProjectTabAccessDialog
          open={tabAccessOpen}
          onClose={() => setTabAccessOpen(false)}
          projectId={projectId}
        />
      )}

      {isProjectLeader && membersOpen && (
        <ProjectMembersDialog
          open={membersOpen}
          onClose={() => setMembersOpen(false)}
          projectId={projectId}
          onMembershipChanged={() => {
            qc.invalidateQueries({ queryKey: ['role-room-seat-status', projectId] });
          }}
        />
      )}

      {isProjectLeader && seatConfirmOpen && seatStatus && (
        <Dialog open={seatConfirmOpen} onClose={() => !seatUpgrading && setSeatConfirmOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Ekstra seat — bekreft</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Du har brukt {seatStatus.usedSeats} av {seatStatus.includedSeats} seats inkludert i
              abonnementet ditt. Hvis du legger til en til vil det koste{' '}
              <strong>{seatStatus.nextSeatCost} kr/mnd</strong> ekstra (ex. mva.).
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Når du bekrefter blir Stripe-abonnementet oppdatert til ny seat-count
              og beløpet legges proporsjonalt på neste faktura. Du kan fjerne
              seats senere ved å fjerne medlemmer.
            </Typography>
            {seatUpgradeError && (
              <Alert severity="error" sx={{ mt: 2 }} onClose={() => setSeatUpgradeError(null)}>
                {seatUpgradeError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSeatConfirmOpen(false)} disabled={seatUpgrading}>Avbryt</Button>
            <Button variant="contained"
                    disabled={seatUpgrading}
                    onClick={async () => {
                      setSeatUpgrading(true);
                      setSeatUpgradeError(null);
                      try {
                        await roleRoomProjectTabConfigService.upgradeSeat(projectId);
                        // Suksess: lukk confirm-dialogen, oppdater seat-status, åpne add-crew
                        await qc.invalidateQueries({ queryKey: ['role-room-seat-status', projectId] });
                        setSeatConfirmOpen(false);
                        setOpen(true);
                      } catch (err) {
                        setSeatUpgradeError(err instanceof Error ? err.message : String(err));
                      } finally {
                        setSeatUpgrading(false);
                      }
                    }}>
              {seatUpgrading ? 'Oppgraderer…' : 'Bekreft + kjøp seat'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Post Agent must be activated for the project first (via marketplace
          — that's where pricing is shown + accepted). Once 1+ seats exist,
          we surface inline toggles per crew row for fast administration. */}
      {!seatsQuery.isLoading && activeSeats.length === 0 && (
        <Alert
          severity="info"
          icon={false}
          sx={{
            mb: 2,
            background: 'linear-gradient(135deg, rgba(160, 48, 192, 0.10) 0%, rgba(110, 63, 199, 0.05) 100%)',
            border: '1px solid rgba(160, 48, 192, 0.30)',
            color: 'text.primary',
          }}
          action={
            <Button
              size="small"
              variant="contained"
              href={`/marketplace/post-agent?productionId=${encodeURIComponent(projectId)}`}
              sx={{ bgcolor: '#a030c0', '&:hover': { bgcolor: '#b94dd6' } }}
            >
              Aktiver i marketplace
            </Button>
          }
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Post Agent ikke aktivert for dette prosjektet
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Aktiver i marketplace (299 NOK/seat/mnd, du ser pris-preview + bekrefter) — så
            kan du tildele crew-seats herfra med ett klikk.
          </Typography>
        </Alert>
      )}

      {/* Bulk-grant: only after project activation, only if there are
          unseated crew with email to grant. */}
      {activeSeats.length > 0 && (() => {
        const unseatedWithEmail = crew.filter((c) => {
          const email = c.email?.trim().toLowerCase();
          return !!email && !seatByEmail.get(email);
        });
        if (unseatedWithEmail.length === 0) return null;
        return (
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              variant="outlined"
              disabled={!!bulkProgress}
              onClick={handleBulkGrant}
              sx={{
                borderColor: '#a030c0',
                color: '#a030c0',
                '&:hover': { borderColor: '#b94dd6', bgcolor: 'rgba(160,48,192,0.05)' },
              }}
            >
              {bulkProgress
                ? `Tildeler… (${bulkProgress.done}/${bulkProgress.total})`
                : `Tildel alle med epost (${unseatedWithEmail.length})`}
            </Button>
          </Box>
        );
      })()}

      {crew.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Ingen crew-medlemmer ennå
        </Typography>
      ) : (
        <List dense>
          {crew.map((c) => {
            const email = c.email?.trim().toLowerCase();
            const seat = email ? seatByEmail.get(email) : undefined;
            const isBusy = busyRow === c.id;
            const err = rowError && rowError.rowId === c.id ? rowError : null;
            const projectActivated = activeSeats.length > 0;
            return (
              <ListItem
                key={c.id}
                sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 0.5, py: 1 }}
                secondaryAction={null}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                  <Avatar sx={{ bgcolor: '#ec4899', width: 32, height: 32 }}>
                    <GroupIcon fontSize="small" />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[c.role, c.department, c.email].filter(Boolean).join(' · ') || '—'}
                    </Typography>
                  </Box>
                  {!projectActivated ? null : !c.email ? (
                    <Chip size="small" label="Trenger e-post" sx={{ opacity: 0.6 }} />
                  ) : seat ? (
                    <Chip
                      size="small"
                      label={isBusy ? '...' : 'Post Agent ✓'}
                      onDelete={isBusy ? undefined : () => handleToggle(c, seat)}
                      sx={{
                        bgcolor: 'rgba(74, 212, 138, 0.18)',
                        color: '#2a9568',
                        fontWeight: 600,
                        '& .MuiChip-deleteIcon': { color: '#2a9568' },
                      }}
                    />
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={isBusy}
                      onClick={() => handleToggle(c, undefined)}
                      sx={{
                        borderColor: '#a030c0',
                        color: '#a030c0',
                        '&:hover': { borderColor: '#b94dd6', bgcolor: 'rgba(160,48,192,0.05)' },
                      }}
                    >
                      {isBusy ? '...' : 'Tildel seat'}
                    </Button>
                  )}
                </Box>
                {err && (
                  <Alert
                    severity="warning"
                    sx={{ ml: 6, py: 0.25 }}
                    action={
                      err.cta ? (
                        <Button size="small" href={err.cta.url}>{err.cta.label}</Button>
                      ) : undefined
                    }
                  >
                    {err.msg}
                  </Alert>
                )}
              </ListItem>
            );
          })}
        </List>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nytt crew-medlem</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Navn" value={name} onChange={(e) => setName(e.target.value)} fullWidth autoFocus />
          <TextField label="Rolle" value={role} onChange={(e) => setRole(e.target.value)} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={!name.trim() || !role.trim() || onAdd.isPending}
            onClick={async () => {
              await onAdd.mutateAsync({ projectId, data: { name: name.trim(), role: role.trim() } });
              setName('');
              setRole('');
              setOpen(false);
            }}
          >
            Legg til
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function ScheduleSubPanel({
  schedules,
  loading,
}: {
  schedules: Array<Record<string, unknown>>;
  loading: boolean;
}) {
  if (loading) return <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />;

  if (schedules.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CalendarIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Ingen tidspunkter planlagt ennå
        </Typography>
      </Box>
    );
  }

  return (
    <List dense>
      {schedules.map((s, i) => (
        <ListItem key={String(s.id ?? i)}>
          <Avatar sx={{ mr: 1.5, bgcolor: '#6366f1', width: 32, height: 32 }}>
            <ScheduleIcon fontSize="small" />
          </Avatar>
          <ListItemText
            primary={String(s.title ?? s.event_type ?? `Hendelse ${i + 1}`)}
            secondary={
              s.start_time
                ? `${formatDate(String(s.start_time))} – ${formatDate(String(s.end_time ?? ''))}`
                : undefined
            }
          />
          <Chip label={String(s.status ?? 'planlagt')} size="small" />
        </ListItem>
      ))}
    </List>
  );
}
