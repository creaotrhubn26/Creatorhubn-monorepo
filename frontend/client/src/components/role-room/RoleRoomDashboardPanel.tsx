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

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Sync as SyncIcon,
  Person as PersonIcon,
  Group as GroupIcon,
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
} from '@mui/icons-material';

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

type SubTab = 'roles' | 'candidates' | 'crew' | 'schedule' | 'publishing';

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
    await createProjectMut.mutateAsync({
      name: newProjectName.trim(),
      description: newProjectDesc.trim() || undefined,
      creatorhubProjectId: creatorhubProjectId ?? undefined,
    });
    setNewProjectName('');
    setNewProjectDesc('');
    setNewProjectOpen(false);
  }, [newProjectName, newProjectDesc, creatorhubProjectId, createProjectMut]);

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

  // ── Render ───────────────────────────────────────────────

  if (projectsLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={120} sx={{ mb: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* ── Header ─────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
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
        <Stack direction="row" spacing={1}>
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
        </Stack>
      </Box>

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
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
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

              {syncProjectMut.isPending && <LinearProgress />}
              {syncProjectMut.isSuccess && (
                <Alert severity="success" sx={{ mx: 2 }}>
                  Prosjektet ble synkronisert
                </Alert>
              )}

              {/* Sub-tabs */}
              <Tabs
                value={subTab}
                onChange={(_, v: SubTab) => setSubTab(v)}
                sx={{ px: 2 }}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab
                  value="roles"
                  label="Roller"
                  icon={<TheaterIcon fontSize="small" />}
                  iconPosition="start"
                  sx={{ minHeight: 48 }}
                />
                <Tab
                  value="candidates"
                  label="Kandidater"
                  icon={<PersonIcon fontSize="small" />}
                  iconPosition="start"
                  sx={{ minHeight: 48 }}
                />
                <Tab
                  value="crew"
                  label="Crew"
                  icon={<GroupIcon fontSize="small" />}
                  iconPosition="start"
                  sx={{ minHeight: 48 }}
                />
                <Tab
                  value="schedule"
                  label="Tidsplan"
                  icon={<CalendarIcon fontSize="small" />}
                  iconPosition="start"
                  sx={{ minHeight: 48 }}
                />
                {canUsePublishing && (
                  <Tab
                    value="publishing"
                    label="Publisering"
                    icon={<YouTubeIcon fontSize="small" />}
                    iconPosition="start"
                    sx={{ minHeight: 48 }}
                  />
                )}
              </Tabs>
              <Divider />

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
              </CardContent>
            </Card>
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
    </Box>
  );
};

export default RoleRoomDashboardPanel;

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
              await onCreate.mutateAsync({ projectId, data: { name: name.trim() } });
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
              await onAdd.mutateAsync({ projectId, data: { name: name.trim(), email: email.trim() || undefined } });
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
}: {
  projectId: string;
  crew: CrewMember[];
  loading: boolean;
  onAdd: ReturnType<typeof useAddCrewMember>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');

  if (loading) return <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Crew ({crew.length})
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Legg til
        </Button>
      </Box>

      {crew.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Ingen crew-medlemmer ennå
        </Typography>
      ) : (
        <List dense>
          {crew.map((c) => (
            <ListItem key={c.id}>
              <Avatar sx={{ mr: 1.5, bgcolor: '#ec4899', width: 32, height: 32 }}>
                <GroupIcon fontSize="small" />
              </Avatar>
              <ListItemText primary={c.name} secondary={[c.role, c.department].filter(Boolean).join(' · ')} />
            </ListItem>
          ))}
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
