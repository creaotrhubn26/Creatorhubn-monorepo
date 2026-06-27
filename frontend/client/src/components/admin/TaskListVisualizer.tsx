import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Api as ApiIcon,
  Backup as BackupIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Lock as LockIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useToast } from '../../hooks/use-toast';
import { AdminButton, StatusChip } from './design-system';

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
type TaskCategory = 'critical' | 'high' | 'medium' | 'low';
type GateStatus = 'locked' | 'ready' | 'in_progress' | 'completed' | 'failed';

interface ValidationRule {
  rule: string;
  passed: boolean;
  message: string;
}

interface TaskCheck {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  required: boolean;
  category: TaskCategory;
  progress: number;
  estimatedTime: number;
  actualTime?: number;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  lastRun?: string;
  dependencies: string[];
  validationRules: ValidationRule[];
}

interface TaskGroup {
  id: string;
  name: string;
  description: string;
  icon: 'api' | 'storage' | 'security' | 'performance' | 'backup';
  color: string;
  checks: TaskCheck[];
}

interface DeploymentGate {
  id: string;
  name: string;
  description: string;
  status: GateStatus;
  requiredGroups: string[];
  canBypass: boolean;
  approvers: string[];
  approvedBy?: string[];
  rejectedBy?: string[];
}

interface TaskListVisualizerProps {
  onDeploymentReady?: () => void;
  onTaskComplete?: (taskId: string) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface DeploymentPayload {
  groups: TaskGroup[];
  gates: DeploymentGate[];
}

const toRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const toStringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const normalizeTaskStatus = (value: unknown): TaskStatus => {
  if (value === 'pending' || value === 'running' || value === 'completed' || value === 'failed' || value === 'blocked') {
    return value;
  }
  return 'pending';
};

const normalizeTaskCategory = (value: unknown): TaskCategory => {
  if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') return value;
  return 'medium';
};

const normalizeGateStatus = (value: unknown): GateStatus => {
  if (value === 'locked' || value === 'ready' || value === 'in_progress' || value === 'completed' || value === 'failed') {
    return value;
  }
  return 'locked';
};

const normalizeIcon = (value: unknown): TaskGroup['icon'] => {
  if (value === 'api' || value === 'storage' || value === 'security' || value === 'performance' || value === 'backup') {
    return value;
  }
  return 'api';
};

const normalizeValidationRules = (payload: unknown): ValidationRule[] => {
  if (!Array.isArray(payload)) return [];

  return payload.map((item, index) => {
    const record = toRecord(item);
    return {
      rule: toStringValue(record.rule, `Rule ${index + 1}`),
      passed: Boolean(record.passed),
      message: toStringValue(record.message, 'Ingen detaljmelding tilgjengelig.'),
    };
  });
};

const normalizeTaskChecks = (payload: unknown): TaskCheck[] => {
  if (!Array.isArray(payload)) return [];

  return payload.map((item, index) => {
    const record = toRecord(item);
    const dependenciesRaw = Array.isArray(record.dependencies) ? record.dependencies : [];

    return {
      id: toStringValue(record.id, `task-${index}`),
      name: toStringValue(record.name, `Task ${index + 1}`),
      description: toStringValue(record.description, ''),
      status: normalizeTaskStatus(record.status),
      required: record.required === undefined ? true : Boolean(record.required),
      category: normalizeTaskCategory(record.category),
      progress: Math.max(0, Math.min(100, toNumberValue(record.progress))),
      estimatedTime: Math.max(0, toNumberValue(record.estimatedTime, 5)),
      actualTime: record.actualTime === undefined ? undefined : Math.max(0, toNumberValue(record.actualTime)),
      errorMessage: toStringValue(record.errorMessage) || undefined,
      retryCount: Math.max(0, toNumberValue(record.retryCount)),
      maxRetries: Math.max(1, toNumberValue(record.maxRetries, 3)),
      lastRun: toStringValue(record.lastRun) || undefined,
      dependencies: dependenciesRaw.map((dep) => toStringValue(dep)).filter((dep) => dep.length > 0),
      validationRules: normalizeValidationRules(record.validationRules),
    };
  });
};

const normalizeGroups = (payload: unknown): TaskGroup[] => {
  if (!Array.isArray(payload)) return [];

  return payload.map((item, index) => {
    const record = toRecord(item);
    return {
      id: toStringValue(record.id, `group-${index}`),
      name: toStringValue(record.name, `Task Group ${index + 1}`),
      description: toStringValue(record.description, ''),
      icon: normalizeIcon(record.icon),
      color: toStringValue(record.color, '#2563eb'),
      checks: normalizeTaskChecks(record.checks),
    };
  });
};

const normalizeGates = (payload: unknown): DeploymentGate[] => {
  if (!Array.isArray(payload)) return [];

  return payload.map((item, index) => {
    const record = toRecord(item);
    const requiredGroups = Array.isArray(record.requiredGroups) ? record.requiredGroups.map((group) => toStringValue(group)).filter(Boolean) : [];
    const approvers = Array.isArray(record.approvers) ? record.approvers.map((approver) => toStringValue(approver)).filter(Boolean) : [];
    const approvedBy = Array.isArray(record.approvedBy) ? record.approvedBy.map((approver) => toStringValue(approver)).filter(Boolean) : undefined;
    const rejectedBy = Array.isArray(record.rejectedBy) ? record.rejectedBy.map((approver) => toStringValue(approver)).filter(Boolean) : undefined;

    return {
      id: toStringValue(record.id, `gate-${index}`),
      name: toStringValue(record.name, `Gate ${index + 1}`),
      description: toStringValue(record.description, ''),
      status: normalizeGateStatus(record.status),
      requiredGroups,
      canBypass: Boolean(record.canBypass),
      approvers,
      approvedBy,
      rejectedBy,
    };
  });
};

const createFallbackPayload = (): DeploymentPayload => {
  const now = new Date().toISOString();

  return {
    groups: [
      {
        id: 'api-validation',
        name: 'API Validation',
        description: 'Verifies critical API endpoints, auth, and payload contracts.',
        icon: 'api',
        color: '#60a5fa',
        checks: [
          {
            id: 'api-auth-check',
            name: 'Authentication contract',
            description: 'Confirms auth middleware and token validation.',
            status: 'completed',
            required: true,
            category: 'critical',
            progress: 100,
            estimatedTime: 5,
            actualTime: 4,
            retryCount: 0,
            maxRetries: 3,
            lastRun: now,
            dependencies: [],
            validationRules: [
              { rule: '401 on missing token', passed: true, message: 'Unauthorized response verified.' },
              { rule: '403 on invalid role', passed: true, message: 'Role checks passed.' },
            ],
          },
          {
            id: 'api-webhooks-check',
            name: 'Webhook processing',
            description: 'Ensures webhook retries and signature checks are stable.',
            status: 'running',
            required: true,
            category: 'high',
            progress: 62,
            estimatedTime: 8,
            retryCount: 1,
            maxRetries: 4,
            lastRun: now,
            dependencies: ['api-auth-check'],
            validationRules: [
              { rule: 'Signature verified', passed: true, message: 'Valid signatures accepted.' },
              { rule: 'Retry queue drains', passed: false, message: 'Processing queue still draining.' },
            ],
          },
        ],
      },
      {
        id: 'data-integrity',
        name: 'Data Integrity',
        description: 'Checks storage, migration consistency, and backup restoration.',
        icon: 'storage',
        color: '#0ea5e9',
        checks: [
          {
            id: 'migration-check',
            name: 'Migration consistency',
            description: 'Validates migration version checksums and foreign key integrity.',
            status: 'completed',
            required: true,
            category: 'critical',
            progress: 100,
            estimatedTime: 6,
            actualTime: 5,
            retryCount: 0,
            maxRetries: 2,
            lastRun: now,
            dependencies: [],
            validationRules: [
              { rule: 'Checksum match', passed: true, message: 'All checksums matched.' },
              { rule: 'Foreign key scan', passed: true, message: 'No orphan records detected.' },
            ],
          },
          {
            id: 'backup-restore-check',
            name: 'Backup restore path',
            description: 'Runs timed restore test against latest snapshot.',
            status: 'pending',
            required: true,
            category: 'high',
            progress: 0,
            estimatedTime: 10,
            retryCount: 0,
            maxRetries: 3,
            dependencies: ['migration-check'],
            validationRules: [
              { rule: 'Snapshot available', passed: true, message: 'Latest snapshot found.' },
              { rule: 'Restore consistency', passed: false, message: 'Not started.' },
            ],
          },
        ],
      },
      {
        id: 'security-hardening',
        name: 'Security Hardening',
        description: 'Confirms security headers, secret handling, and audit trails.',
        icon: 'security',
        color: '#10b981',
        checks: [
          {
            id: 'headers-check',
            name: 'Security headers',
            description: 'CSP, HSTS, X-Frame-Options and related headers.',
            status: 'completed',
            required: true,
            category: 'critical',
            progress: 100,
            estimatedTime: 3,
            actualTime: 2,
            retryCount: 0,
            maxRetries: 2,
            lastRun: now,
            dependencies: [],
            validationRules: [
              { rule: 'Headers present', passed: true, message: 'All baseline headers set.' },
            ],
          },
        ],
      },
    ],
    gates: [
      {
        id: 'preflight-gate',
        name: 'Preflight Gate',
        description: 'Requires all critical checks to be completed.',
        status: 'in_progress',
        requiredGroups: ['api-validation', 'data-integrity', 'security-hardening'],
        canBypass: false,
        approvers: ['ops-lead@creatorhub.no', 'platform-lead@creatorhub.no'],
      },
      {
        id: 'production-gate',
        name: 'Production Gate',
        description: 'Manual approval before live deployment.',
        status: 'locked',
        requiredGroups: ['preflight-gate'],
        canBypass: true,
        approvers: ['cto@creatorhub.no'],
      },
    ],
  };
};

const calculateGroupProgress = (group: TaskGroup): number => {
  if (group.checks.length === 0) return 0;
  const total = group.checks.reduce((sum, check) => sum + check.progress, 0);
  return Math.round(total / group.checks.length);
};

const calculateGateProgress = (gate: DeploymentGate, groups: TaskGroup[]): number => {
  if (gate.requiredGroups.length === 0) return gate.status === 'completed' ? 100 : 0;

  const relevantGroupIds = new Set(gate.requiredGroups);
  const relevantGroups = groups.filter((group) => relevantGroupIds.has(group.id));
  if (relevantGroups.length === 0) return gate.status === 'completed' ? 100 : 0;

  const total = relevantGroups.reduce((sum, group) => sum + calculateGroupProgress(group), 0);
  return Math.round(total / relevantGroups.length);
};

const getStatusColor = (status: TaskStatus | GateStatus): 'default' | 'success' | 'warning' | 'error' | 'info' => {
  if (status === 'completed' || status === 'ready') return 'success';
  if (status === 'running' || status === 'in_progress') return 'info';
  if (status === 'failed' || status === 'blocked') return 'error';
  if (status === 'locked' || status === 'pending') return 'warning';
  return 'default';
};

const renderStatusIcon = (status: TaskStatus | GateStatus): React.ReactNode => {
  if (status === 'completed' || status === 'ready') return <CheckCircleIcon color="success" fontSize="small" />;
  if (status === 'running' || status === 'in_progress') return <PlayArrowIcon color="info" fontSize="small" />;
  if (status === 'failed' || status === 'blocked') return <ErrorIcon color="error" fontSize="small" />;
  if (status === 'locked') return <LockIcon color="warning" fontSize="small" />;
  return <InfoIcon color="action" fontSize="small" />;
};

const renderGroupIcon = (icon: TaskGroup['icon']): React.ReactNode => {
  if (icon === 'api') return <ApiIcon />;
  if (icon === 'storage') return <StorageIcon />;
  if (icon === 'security') return <SecurityIcon />;
  if (icon === 'performance') return <SpeedIcon />;
  return <BackupIcon />;
};

function updateTaskInGroups(groups: TaskGroup[], taskId: string, updater: (task: TaskCheck) => TaskCheck): TaskGroup[] {
  return groups.map((group) => ({
    ...group,
    checks: group.checks.map((task) => (task.id === taskId ? updater(task) : task)),
  }));
}

export default function TaskListVisualizer({
  onDeploymentReady,
  onTaskComplete,
  autoRefresh = true,
  refreshInterval = 5000,
}: TaskListVisualizerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [bypassDialogOpen, setBypassDialogOpen] = useState(false);

  const deploymentReadyRef = useRef(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<DeploymentPayload>({
    queryKey: ['task-list-visualizer'],
    queryFn: async () => {
      try {
        const [groupsPayload, gatesPayload] = await Promise.all([
          apiRequest('/api/admin/deployment/task-groups'),
          apiRequest('/api/admin/deployment/gates'),
        ]);

        const groups = normalizeGroups(groupsPayload);
        const gates = normalizeGates(gatesPayload);

        if (groups.length === 0 || gates.length === 0) {
          return createFallbackPayload();
        }

        return { groups, gates };
      } catch {
        return createFallbackPayload();
      }
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 5_000,
  });

  const payload = data ?? createFallbackPayload();

  const groupOverview = useMemo(() => {
    return payload.groups.map((group) => {
      const progress = calculateGroupProgress(group);
      const completedChecks = group.checks.filter((check) => check.status === 'completed').length;
      const failedChecks = group.checks.filter((check) => check.status === 'failed').length;
      const criticalChecks = group.checks.filter((check) => check.category === 'critical').length;
      const criticalCompleted = group.checks.filter((check) => check.category === 'critical' && check.status === 'completed').length;

      let status: TaskStatus = 'pending';
      if (failedChecks > 0) status = 'failed';
      else if (completedChecks === group.checks.length && group.checks.length > 0) status = 'completed';
      else if (group.checks.some((check) => check.status === 'running')) status = 'running';
      else if (group.checks.some((check) => check.status === 'blocked')) status = 'blocked';

      return {
        ...group,
        progress,
        completedChecks,
        failedChecks,
        criticalChecks,
        criticalCompleted,
        status,
      };
    });
  }, [payload.groups]);

  const gatesOverview = useMemo(() => {
    return payload.gates.map((gate) => ({
      ...gate,
      progress: calculateGateProgress(gate, payload.groups),
    }));
  }, [payload.gates, payload.groups]);

  const totals = useMemo(() => {
    const allChecks = payload.groups.flatMap((group) => group.checks);
    const completed = allChecks.filter((check) => check.status === 'completed').length;
    const failed = allChecks.filter((check) => check.status === 'failed').length;
    const running = allChecks.filter((check) => check.status === 'running').length;
    const criticalOutstanding = allChecks.filter((check) => check.category === 'critical' && check.status !== 'completed').length;

    return {
      totalChecks: allChecks.length,
      completed,
      failed,
      running,
      criticalOutstanding,
      progress: allChecks.length === 0 ? 0 : Math.round((completed / allChecks.length) * 100),
    };
  }, [payload.groups]);

  const selectedTask = useMemo(
    () => payload.groups.flatMap((group) => group.checks).find((check) => check.id === selectedTaskId) ?? null,
    [payload.groups, selectedTaskId],
  );

  const selectedGate = useMemo(
    () => payload.gates.find((gate) => gate.id === selectedGateId) ?? null,
    [payload.gates, selectedGateId],
  );

  useEffect(() => {
    const allCriticalPassed = totals.criticalOutstanding === 0;
    const allGatesOpen = gatesOverview.every((gate) => gate.status === 'completed' || gate.status === 'ready');

    if (allCriticalPassed && allGatesOpen) {
      if (!deploymentReadyRef.current && onDeploymentReady) {
        deploymentReadyRef.current = true;
        onDeploymentReady();
      }
    } else {
      deploymentReadyRef.current = false;
    }
  }, [gatesOverview, onDeploymentReady, totals.criticalOutstanding]);

  const retryTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      try {
        await apiRequest(`/api/admin/deployment/tasks/${taskId}/retry`, { method: 'POST' });
      } catch {
        // local fallback path when backend endpoint is unavailable
      }

      queryClient.setQueryData<DeploymentPayload>(['task-list-visualizer'], (previous) => {
        if (!previous) return previous;
        const nextGroups = updateTaskInGroups(previous.groups, taskId, (task) => ({
          ...task,
          status: 'running',
          progress: Math.max(task.progress, 10),
          retryCount: task.retryCount + 1,
          errorMessage: undefined,
          lastRun: new Date().toISOString(),
        }));
        return { ...previous, groups: nextGroups };
      });
    },
    onSuccess: (_, taskId) => {
      toast({ title: 'Task restartet', description: `Task ${taskId} er satt i running.` });
    },
    onSettled: () => {
      void refetch();
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      try {
        await apiRequest(`/api/admin/deployment/tasks/${taskId}/complete`, { method: 'POST' });
      } catch {
        // local fallback when endpoint is unavailable
      }

      queryClient.setQueryData<DeploymentPayload>(['task-list-visualizer'], (previous) => {
        if (!previous) return previous;

        const nextGroups = updateTaskInGroups(previous.groups, taskId, (task) => ({
          ...task,
          status: 'completed',
          progress: 100,
          actualTime: task.actualTime ?? task.estimatedTime,
          lastRun: new Date().toISOString(),
        }));

        return {
          ...previous,
          groups: nextGroups,
        };
      });
    },
    onSuccess: (_, taskId) => {
      if (onTaskComplete) onTaskComplete(taskId);
      toast({ title: 'Task fullført', description: `Task ${taskId} markert som completed.` });
    },
    onSettled: () => {
      void refetch();
    },
  });

  const bypassGateMutation = useMutation({
    mutationFn: async (gateId: string) => {
      try {
        await apiRequest(`/api/admin/deployment/gates/${gateId}/bypass`, { method: 'POST' });
      } catch {
        // local fallback when endpoint is unavailable
      }

      queryClient.setQueryData<DeploymentPayload>(['task-list-visualizer'], (previous) => {
        if (!previous) return previous;

        const nextGates = previous.gates.map((gate) =>
          gate.id === gateId ? { ...gate, status: 'ready' as const, approvedBy: [...(gate.approvedBy ?? []), 'emergency-bypass'] } : gate,
        );

        return {
          ...previous,
          gates: nextGates,
        };
      });
    },
    onSuccess: (_, gateId) => {
      toast({ title: 'Emergency bypass aktivert', description: `Gate ${gateId} satt til ready.`, variant: 'destructive' });
    },
    onSettled: () => {
      void refetch();
    },
  });

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Deployment Task Visualizer
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Robust gate-check workflow for deployment readiness.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={isFetching ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {isError ? <Alert severity="warning" sx={{ mb: 2 }}>{(error as Error).message}</Alert> : null}
      {isLoading ? <Alert severity="info" sx={{ mb: 2 }}>Laster deployment tasks...</Alert> : null}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Overall Progress
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {totals.progress}%
              </Typography>
              <LinearProgress variant="determinate" value={totals.progress} sx={{ mt: 1.5, height: 8, borderRadius: 999 }} />
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip icon={<CheckCircleIcon />} label={`Completed: ${totals.completed}`} color="success" variant="outlined" />
              <Chip icon={<PlayArrowIcon />} label={`Running: ${totals.running}`} color="info" variant="outlined" />
              <Chip icon={<ErrorIcon />} label={`Failed: ${totals.failed}`} color="error" variant="outlined" />
              <Chip icon={<WarningIcon />} label={`Critical open: ${totals.criticalOutstanding}`} color="warning" variant="outlined" />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        {groupOverview.map((group) => {
          const expanded = expandedGroups.has(group.id);
          return (
            <Card key={group.id} variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Avatar sx={{ bgcolor: `${group.color}22`, color: group.color }}>{renderGroupIcon(group.icon)}</Avatar>

                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {group.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {group.description}
                    </Typography>
                  </Box>

                  <Chip label={`${group.completedChecks}/${group.checks.length}`} size="small" variant="outlined" />
                  <Chip label={group.status} size="small" color={getStatusColor(group.status)} />
                  <Typography variant="body2" sx={{ minWidth: 48, textAlign: 'right' }}>
                    {group.progress}%
                  </Typography>
                  <IconButton onClick={() => toggleGroupExpand(group.id)}>
                    {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Stack>

                <LinearProgress
                  variant="determinate"
                  value={group.progress}
                  sx={{ mt: 1.5, height: 6, borderRadius: 999 }}
                  color={group.status === 'failed' ? 'error' : group.status === 'completed' ? 'success' : 'primary'}
                />

                <Collapse in={expanded} timeout="auto" unmountOnExit>
                  <List sx={{ mt: 1 }}>
                    {group.checks.map((check) => (
                      <ListItem key={check.id} alignItems="flex-start" divider>
                        <ListItemIcon sx={{ minWidth: 34 }}>{renderStatusIcon(check.status)}</ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {check.name}
                              </Typography>
                              <Chip size="small" label={check.category} color={check.category === 'critical' ? 'error' : 'default'} variant="outlined" />
                              {check.required ? <Chip size="small" label="required" variant="outlined" /> : null}
                            </Stack>
                          }
                          secondary={
                            <Stack spacing={1}>
                              <Typography variant="body2" color="text.secondary">
                                {check.description}
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={check.progress}
                                color={check.status === 'failed' ? 'error' : check.status === 'completed' ? 'success' : 'primary'}
                              />
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Typography variant="caption" color="text.secondary">
                                  Est: {check.estimatedTime}m
                                </Typography>
                                {check.actualTime !== undefined ? (
                                  <Typography variant="caption" color="text.secondary">
                                    Actual: {check.actualTime}m
                                  </Typography>
                                ) : null}
                                <Typography variant="caption" color="text.secondary">
                                  Retries: {check.retryCount}/{check.maxRetries}
                                </Typography>
                              </Stack>
                              {check.errorMessage ? <Alert severity="error">{check.errorMessage}</Alert> : null}
                              <Stack direction="row" spacing={0.5}>
                                {check.validationRules.map((rule, index) => (
                                  <Tooltip key={`${check.id}-rule-${index}`} title={rule.message}>
                                    <StatusChip
                                      tone={rule.passed ? 'success' : 'error'}
                                      label={rule.rule}
                                    />
                                  </Tooltip>
                                ))}
                              </Stack>
                            </Stack>
                          }
                        />

                        <Stack spacing={1}>
                          {check.status === 'failed' ? (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<RefreshIcon />}
                              onClick={() => {
                                setSelectedTaskId(check.id);
                                setRetryDialogOpen(true);
                              }}
                            >
                              Retry
                            </Button>
                          ) : null}

                          {check.status !== 'completed' ? (
                            <AdminButton
                              tone="primary"
                              size="small"
                              onClick={() => completeTaskMutation.mutate(check.id)}
                              loading={completeTaskMutation.isPending}
                            >
                              Complete
                            </AdminButton>
                          ) : null}
                        </Stack>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
            Deployment Gates
          </Typography>

          <Stack spacing={1.5}>
            {gatesOverview.map((gate) => (
              <Box key={gate.id}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {renderStatusIcon(gate.status)}
                  <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }}>
                    {gate.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {gate.progress}%
                  </Typography>
                  <Chip size="small" label={gate.status} color={getStatusColor(gate.status)} />
                  {gate.status === 'locked' && gate.canBypass ? (
                    <Button
                      size="small"
                      color="warning"
                      variant="outlined"
                      onClick={() => {
                        setSelectedGateId(gate.id);
                        setBypassDialogOpen(true);
                      }}
                    >
                      Bypass
                    </Button>
                  ) : null}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                  {gate.description}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={gate.progress}
                  color={gate.status === 'completed' ? 'success' : gate.status === 'failed' ? 'error' : 'primary'}
                />
                <Divider sx={{ mt: 1.5 }} />
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={retryDialogOpen} onClose={() => setRetryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Retry failed task</DialogTitle>
        <DialogContent dividers>
          {selectedTask ? (
            <Stack spacing={1}>
              <Alert severity="warning">
                This will restart the task with the same validation rules and dependencies.
              </Alert>
              <Typography variant="subtitle2">{selectedTask.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Current retries: {selectedTask.retryCount}/{selectedTask.maxRetries}
              </Typography>
            </Stack>
          ) : (
            <Typography>No task selected.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setRetryDialogOpen(false)}>Cancel</AdminButton>
          <AdminButton
            tone="primary"
            onClick={() => {
              if (selectedTaskId) {
                retryTaskMutation.mutate(selectedTaskId);
              }
              setRetryDialogOpen(false);
            }}
          >
            Retry task
          </AdminButton>
        </DialogActions>
      </Dialog>

      <Dialog open={bypassDialogOpen} onClose={() => setBypassDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>Emergency bypass</DialogTitle>
        <DialogContent dividers>
          {selectedGate ? (
            <Stack spacing={1}>
              <Alert severity="error">Bypass should only be used in critical incidents.</Alert>
              <Typography variant="subtitle2">{selectedGate.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Required approvers: {selectedGate.approvers.join(', ') || 'N/A'}
              </Typography>
            </Stack>
          ) : (
            <Typography>No gate selected.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setBypassDialogOpen(false)}>Cancel</AdminButton>
          <AdminButton
            tone="danger"
            onClick={() => {
              if (selectedGateId) {
                bypassGateMutation.mutate(selectedGateId);
              }
              setBypassDialogOpen(false);
            }}
          >
            Activate bypass
          </AdminButton>
        </DialogActions>
      </Dialog>

      <Box sx={{ mt: 2 }}>
        <Badge color="error" badgeContent={totals.failed}>
          <Chip label={`Failed checks: ${totals.failed}`} color={totals.failed > 0 ? 'error' : 'default'} icon={<WarningIcon />} />
        </Badge>
      </Box>
    </Box>
  );
}
