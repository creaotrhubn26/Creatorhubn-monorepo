import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Flag as FlagIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

type GoalCategory =
  | 'content'
  | 'interaction'
  | 'collaboration'
  | 'learning'
  | 'performance';
type GoalPriority = 'low' | 'medium' | 'high';
type GoalStatus = 'active' | 'completed' | 'paused' | 'cancelled';

interface ProgressGoal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  target: number;
  current: number;
  unit: string;
  priority: GoalPriority;
  status: GoalStatus;
  createdAt: Date;
  completedAt?: Date;
}

interface ProgressMilestone {
  id: string;
  goalId: string;
  title: string;
  targetValue: number;
  achieved: boolean;
  achievedAt?: Date;
}

interface ProgressSession {
  id: string;
  goalId: string;
  date: Date;
  delta: number;
  note: string;
}

interface ProgressStats {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  averageCompletion: number;
  totalDelta: number;
}

interface ProgressTrackingProps {
  className?: string;
  onGoalCompleted?: (goal: ProgressGoal) => void;
  onMilestoneReached?: (milestone: ProgressMilestone) => void;
  onProgressUpdate?: (goal: ProgressGoal, progress: number) => void;
}

interface NewGoalDraft {
  title: string;
  description: string;
  category: GoalCategory;
  target: number;
  unit: string;
  priority: GoalPriority;
}

const INITIAL_GOALS: ProgressGoal[] = [
  {
    id: 'goal-1',
    title: 'Publiser klipp',
    description: 'Publiser ferdige videoklipp denne uken',
    category: 'content',
    target: 8,
    current: 3,
    unit: 'klipp',
    priority: 'high',
    status: 'active',
    createdAt: new Date(),
  },
  {
    id: 'goal-2',
    title: 'Svar pa kundekommentarer',
    description: 'Hold svartid lav pa aktive prosjekt',
    category: 'interaction',
    target: 20,
    current: 12,
    unit: 'svar',
    priority: 'medium',
    status: 'active',
    createdAt: new Date(),
  },
];

const INITIAL_MILESTONES: ProgressMilestone[] = [
  { id: 'm-1', goalId: 'goal-1', title: '50% ferdig', targetValue: 4, achieved: false },
  { id: 'm-2', goalId: 'goal-1', title: '100% ferdig', targetValue: 8, achieved: false },
  { id: 'm-3', goalId: 'goal-2', title: '50% ferdig', targetValue: 10, achieved: true, achievedAt: new Date() },
  { id: 'm-4', goalId: 'goal-2', title: '100% ferdig', targetValue: 20, achieved: false },
];

const INITIAL_SESSIONS: ProgressSession[] = [
  {
    id: 's-1',
    goalId: 'goal-1',
    date: new Date(),
    delta: 1,
    note: 'La til et nytt highlight-klipp',
  },
  {
    id: 's-2',
    goalId: 'goal-2',
    date: new Date(),
    delta: 3,
    note: 'Besvarte kommentarer fra kunder',
  },
];

function getGoalPercent(goal: ProgressGoal): number {
  if (goal.target <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((goal.current / goal.target) * 100));
}

function getStatusColor(status: GoalStatus): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  if (status === 'completed') return 'success';
  if (status === 'active') return 'primary';
  if (status === 'paused') return 'warning';
  if (status === 'cancelled') return 'error';
  return 'default';
}

function getPriorityColor(priority: GoalPriority): 'success' | 'warning' | 'error' {
  if (priority === 'high') return 'error';
  if (priority === 'medium') return 'warning';
  return 'success';
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('nb-NO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

const ProgressTracking: React.FC<ProgressTrackingProps> = ({
  className = '',
  onGoalCompleted,
  onMilestoneReached,
  onProgressUpdate,
}) => {
  const theming = useTheming('photographer');

  const [tab, setTab] = useState(0);
  const [goals, setGoals] = useState<ProgressGoal[]>(INITIAL_GOALS);
  const [milestones, setMilestones] = useState<ProgressMilestone[]>(INITIAL_MILESTONES);
  const [sessions, setSessions] = useState<ProgressSession[]>(INITIAL_SESSIONS);
  const [selectedGoal, setSelectedGoal] = useState<ProgressGoal | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGoal, setNewGoal] = useState<NewGoalDraft>({
    title: '',
    description: '',
    category: 'content',
    target: 10,
    unit: 'enheter',
    priority: 'medium',
  });

  const stats = useMemo<ProgressStats>(() => {
    const totalGoals = goals.length;
    const activeGoals = goals.filter((goal) => goal.status === 'active').length;
    const completedGoals = goals.filter((goal) => goal.status === 'completed').length;
    const averageCompletion =
      totalGoals > 0
        ? goals.reduce((sum, goal) => sum + getGoalPercent(goal), 0) / totalGoals
        : 0;
    const totalDelta = sessions.reduce((sum, session) => sum + session.delta, 0);

    return {
      totalGoals,
      activeGoals,
      completedGoals,
      averageCompletion,
      totalDelta,
    };
  }, [goals, sessions]);

  const applyMilestonesForGoal = useCallback(
    (goalId: string, nextValue: number) => {
      setMilestones((prev) =>
        prev.map((milestone) => {
          if (milestone.goalId !== goalId || milestone.achieved || nextValue < milestone.targetValue) {
            return milestone;
          }

          const reached: ProgressMilestone = {
            ...milestone,
            achieved: true,
            achievedAt: new Date(),
          };
          onMilestoneReached?.(reached);
          return reached;
        }),
      );
    },
    [onMilestoneReached],
  );

  const updateGoalProgress = useCallback(
    (goalId: string, delta: number) => {
      let updatedGoal: ProgressGoal | null = null;
      setGoals((prev) =>
        prev.map((goal) => {
          if (goal.id !== goalId) {
            return goal;
          }

          const nextValue = Math.max(0, Math.min(goal.target, goal.current + delta));
          const nextStatus: GoalStatus =
            nextValue >= goal.target ? 'completed' : goal.status === 'completed' ? 'active' : goal.status;
          updatedGoal = {
            ...goal,
            current: nextValue,
            status: nextStatus,
            completedAt: nextStatus === 'completed' ? new Date() : undefined,
          };

          return updatedGoal;
        }),
      );

      if (!updatedGoal) {
        return;
      }

      setSessions((prev) => [
        {
          id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          goalId,
          date: new Date(),
          delta,
          note: delta > 0 ? `Oppdatert +${delta}` : `Oppdatert ${delta}`,
        },
        ...prev,
      ]);

      applyMilestonesForGoal(goalId, updatedGoal.current);
      onProgressUpdate?.(updatedGoal, delta);
      if (updatedGoal.status === 'completed') {
        onGoalCompleted?.(updatedGoal);
      }
    },
    [applyMilestonesForGoal, onGoalCompleted, onProgressUpdate],
  );

  const createGoal = useCallback(() => {
    if (!newGoal.title.trim()) {
      return;
    }
    const id = `goal-${Date.now()}`;
    const created: ProgressGoal = {
      id,
      title: newGoal.title.trim(),
      description: newGoal.description.trim(),
      category: newGoal.category,
      target: Math.max(1, newGoal.target),
      current: 0,
      unit: newGoal.unit.trim() || 'enheter',
      priority: newGoal.priority,
      status: 'active',
      createdAt: new Date(),
    };

    const generatedMilestones: ProgressMilestone[] = [
      {
        id: `${id}-50`,
        goalId: id,
        title: '50% ferdig',
        targetValue: Math.ceil(created.target / 2),
        achieved: false,
      },
      {
        id: `${id}-100`,
        goalId: id,
        title: '100% ferdig',
        targetValue: created.target,
        achieved: false,
      },
    ];

    setGoals((prev) => [created, ...prev]);
    setMilestones((prev) => [...generatedMilestones, ...prev]);
    setNewGoal({
      title: '',
      description: '',
      category: 'content',
      target: 10,
      unit: 'enheter',
      priority: 'medium',
    });
    setShowCreateDialog(false);
  }, [newGoal]);

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <Paper sx={{ p: 2, mb: 2, ...theming.getThemedCardSx() }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <TrendingUpIcon color="primary" />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Progress Tracking
            </Typography>
          </Stack>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => setShowCreateDialog(true)}
          >
            Add Goal
          </Button>
        </Stack>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h4">{stats.totalGoals}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total Goals
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h4">{stats.activeGoals}</Typography>
              <Typography variant="body2" color="text.secondary">
                Active
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h4">{stats.completedGoals}</Typography>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h4">{stats.averageCompletion.toFixed(1)}%</Typography>
              <Typography variant="body2" color="text.secondary">
                Avg Completion
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ ...theming.getThemedCardSx() }}>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)}>
          <Tab label="Goals" />
          <Tab label="Milestones" />
          <Tab label="Sessions" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {tab === 0 ? (
            <Stack spacing={1.5}>
              {goals.map((goal) => (
                <Card key={goal.id} variant="outlined">
                  <CardContent>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      spacing={1.5}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {goal.title}
                          </Typography>
                          <Chip
                            size="small"
                            label={goal.status}
                            color={getStatusColor(goal.status)}
                          />
                          <Chip
                            size="small"
                            label={goal.priority}
                            color={getPriorityColor(goal.priority)}
                          />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {goal.description}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={getGoalPercent(goal)}
                          sx={{ height: 8, borderRadius: 4, mb: 0.5 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {goal.current}/{goal.target} {goal.unit} ({getGoalPercent(goal)}%)
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => updateGoalProgress(goal.id, 1)}
                          disabled={goal.status === 'completed'}
                        >
                          +1
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => updateGoalProgress(goal.id, 5)}
                          disabled={goal.status === 'completed'}
                        >
                          +5
                        </Button>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => setSelectedGoal(goal)}
                        >
                          Details
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : null}

          {tab === 1 ? (
            <List dense>
              {milestones.map((milestone) => {
                const goal = goals.find((g) => g.id === milestone.goalId);
                return (
                  <ListItem key={milestone.id}>
                    <ListItemText
                      primary={milestone.title}
                      secondary={`${goal?.title ?? 'Unknown goal'} - Target ${milestone.targetValue}`}
                    />
                    {milestone.achieved ? (
                      <Chip icon={<CheckCircleIcon />} color="success" label="Achieved" />
                    ) : (
                      <Chip icon={<FlagIcon />} color="default" label="Pending" />
                    )}
                  </ListItem>
                );
              })}
            </List>
          ) : null}

          {tab === 2 ? (
            <List dense>
              {sessions.map((session) => {
                const goal = goals.find((g) => g.id === session.goalId);
                return (
                  <ListItem key={session.id}>
                    <ListItemText
                      primary={`${goal?.title ?? 'Unknown goal'} (${session.delta > 0 ? '+' : ''}${session.delta})`}
                      secondary={`${formatDate(session.date)} - ${session.note}`}
                    />
                  </ListItem>
                );
              })}
              {sessions.length === 0 ? (
                <Alert severity="info">Ingen progresjonssesjoner registrert ennå.</Alert>
              ) : null}
            </List>
          ) : null}
        </Box>
      </Paper>

      <Dialog open={Boolean(selectedGoal)} onClose={() => setSelectedGoal(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Goal details</DialogTitle>
        <DialogContent>
          {selectedGoal ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Typography variant="h6">{selectedGoal.title}</Typography>
              <Typography variant="body2">{selectedGoal.description}</Typography>
              <Typography variant="body2" color="text.secondary">
                Category: {selectedGoal.category}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Progress: {selectedGoal.current}/{selectedGoal.target} {selectedGoal.unit}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Created: {formatDate(selectedGoal.createdAt)}
              </Typography>
              {selectedGoal.completedAt ? (
                <Typography variant="body2" color="text.secondary">
                  Completed: {formatDate(selectedGoal.completedAt)}
                </Typography>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedGoal(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add new goal</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={newGoal.title}
              onChange={(event) =>
                setNewGoal((prev) => ({ ...prev, title: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Description"
              value={newGoal.description}
              onChange={(event) =>
                setNewGoal((prev) => ({ ...prev, description: event.target.value }))
              }
              fullWidth
              multiline
              minRows={2}
            />
            <FormControl fullWidth>
              <InputLabel id="goal-category-label">Category</InputLabel>
              <Select
                labelId="goal-category-label"
                value={newGoal.category}
                label="Category"
                onChange={(event) =>
                  setNewGoal((prev) => ({
                    ...prev,
                    category: event.target.value as GoalCategory,
                  }))
                }
              >
                <MenuItem value="content">Content</MenuItem>
                <MenuItem value="interaction">Interaction</MenuItem>
                <MenuItem value="collaboration">Collaboration</MenuItem>
                <MenuItem value="learning">Learning</MenuItem>
                <MenuItem value="performance">Performance</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Target"
              type="number"
              inputProps={{ min: 1 }}
              value={newGoal.target}
              onChange={(event) =>
                setNewGoal((prev) => ({
                  ...prev,
                  target: Number(event.target.value || 1),
                }))
              }
            />
            <TextField
              label="Unit"
              value={newGoal.unit}
              onChange={(event) =>
                setNewGoal((prev) => ({ ...prev, unit: event.target.value }))
              }
            />
            <FormControl fullWidth>
              <InputLabel id="goal-priority-label">Priority</InputLabel>
              <Select
                labelId="goal-priority-label"
                value={newGoal.priority}
                label="Priority"
                onChange={(event) =>
                  setNewGoal((prev) => ({
                    ...prev,
                    priority: event.target.value as GoalPriority,
                  }))
                }
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={createGoal} disabled={!newGoal.title.trim()}>
            Save goal
          </Button>
        </DialogActions>
      </Dialog>

      <Paper sx={{ p: 1.5, mt: 2, ...theming.getThemedCardSx() }}>
        <Typography variant="body2" color="text.secondary">
          Total updates logged: {stats.totalDelta}
        </Typography>
      </Paper>
    </Box>
  );
};

export default ProgressTracking;

