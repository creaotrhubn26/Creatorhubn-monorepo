// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  Add,
  Delete,
  Edit,
  Refresh,
  Schedule,
  Task,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';

interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string | null;
  completed?: string | null;
  position: string;
  parent?: string | null;
  links?: Array<{
    type: string;
    link: string;
  }>;
  selfLink: string | null;
  updated: string | null;
  listId?: string;
}

interface GoogleTaskList {
  id: string;
  title: string;
  selfLink: string | null;
  updated: string | null;
}

interface GoogleTasksIntegrationProps {
  profession: string;
  userId: string;
  projectId?: string;
}

type TaskFilterStatus = 'all' | 'needsAction' | 'completed';
type TaskSortKey = 'position' | 'due' | 'updated';

interface TaskFormState {
  title: string;
  notes: string;
  due: string;
  parent: string;
}

interface CreateTaskEventPayload {
  taskData?: Partial<TaskFormState>;
  listId?: string;
}

interface UpdateTaskEventPayload {
  task?: GoogleTask;
}

interface CompleteTaskEventPayload {
  taskId?: string;
}

interface FilterChangeEventPayload {
  filterStatus?: TaskFilterStatus;
}

const createEmptyTaskForm = (): TaskFormState => ({
  title: '',
  notes: '',
  due: '',
  parent: '',
});

const GoogleTasksIntegration: React.FC<GoogleTasksIntegrationProps> = ({
  profession,
  userId,
  projectId,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  const theming = useTheming(profession || 'photographer');

  const effectiveUserId = userId || user?.id || user?.email || 'default-user';
  const [selectedTaskList, setSelectedTaskList] = useState('');
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<GoogleTask | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskFilterStatus>('all');
  const [sortBy, setSortBy] = useState<TaskSortKey>('position');
  const [taskFormData, setTaskFormData] = useState<TaskFormState>(createEmptyTaskForm());

  const {
    data: taskLists = [],
    isLoading: listsLoading,
    isFetching: listsFetching,
    error: taskListsError,
    refetch: refetchTaskLists,
  } = useQuery<GoogleTaskList[], Error>({
    queryKey: ['/api/google-tasks/lists'],
    queryFn: async () => {
      const response = await apiRequest('/api/google-tasks/lists');
      return Array.isArray(response) ? response as GoogleTaskList[] : [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const {
    data: tasks = [],
    isLoading: tasksLoading,
    isFetching: tasksFetching,
    error: tasksError,
    refetch: refetchTasks,
  } = useQuery<GoogleTask[], Error>({
    queryKey: ['/api/google-tasks/tasks', selectedTaskList],
    queryFn: async () => {
      if (!selectedTaskList) {
        return [];
      }
      const response = await apiRequest(`/api/google-tasks/lists/${selectedTaskList}/tasks`);
      return Array.isArray(response) ? response as GoogleTask[] : [];
    },
    enabled: Boolean(selectedTaskList),
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (!selectedTaskList && taskLists[0]?.id) {
      setSelectedTaskList(taskLists[0].id);
    }
  }, [selectedTaskList, taskLists]);

  useEffect(() => {
    const unregisterKey = 'GoogleTasksIntegration';
    componentRegistry.registerComponent(unregisterKey, {
      type: 'google-service',
      capabilities: ['task-management', 'task-list-management', 'task-sync', 'project-integration'],
      dataFlow: {
        sources: ['task-lists', 'tasks', 'task-form-data', 'view-settings'],
        destinations: ['admin-dashboard', 'user-interface', 'project-system', 'crm-system'],
        processors: ['task-processing', 'sync-processing'],
      },
    });

    dataFlow.registerNode('task-lists', {
      type: 'source',
      data: taskLists,
      metadata: { component: 'GoogleTasksIntegration', type: 'task-lists' },
    });
    dataFlow.registerNode('tasks', {
      type: 'source',
      data: tasks,
      metadata: { component: 'GoogleTasksIntegration', type: 'tasks' },
    });
    dataFlow.registerNode('task-form-data', {
      type: 'source',
      data: taskFormData,
      metadata: { component: 'GoogleTasksIntegration', type: 'task-form-data' },
    });
    dataFlow.registerNode('view-settings', {
      type: 'source',
      data: {
        selectedTaskList,
        filterStatus,
        sortBy,
        profession,
        projectId: projectId || null,
        userId: effectiveUserId,
      },
      metadata: { component: 'GoogleTasksIntegration', type: 'view-settings' },
    });

    const unsubscribeCreate = communication.subscribe(
      'google-tasks: create-task',
      (data: CreateTaskEventPayload) => {
        if (data.listId) {
          setSelectedTaskList(data.listId);
        }
        setEditingTask(null);
        setTaskFormData({
          title: data.taskData?.title || '',
          notes: data.taskData?.notes || '',
          due: data.taskData?.due || '',
          parent: data.taskData?.parent || '',
        });
        setCreateTaskOpen(true);
      },
    );

    const unsubscribeUpdate = communication.subscribe(
      'google-tasks: update-task',
      (data: UpdateTaskEventPayload) => {
        if (!data.task) {
          return;
        }
        setEditingTask(data.task);
        setTaskFormData({
          title: data.task.title,
          notes: data.task.notes || '',
          due: data.task.due || '',
          parent: data.task.parent || '',
        });
        setCreateTaskOpen(true);
      },
    );

    const unsubscribeComplete = communication.subscribe(
      'google-tasks: complete-task',
      (data: CompleteTaskEventPayload) => {
        if (data.taskId) {
          completeTaskMutation.mutate(data.taskId);
        }
      },
    );

    const unsubscribeFilter = communication.subscribe(
      'google-tasks: filter-change',
      (data: FilterChangeEventPayload) => {
        if (data.filterStatus) {
          setFilterStatus(data.filterStatus);
        }
      },
    );

    return () => {
      if (typeof unsubscribeCreate === 'function') unsubscribeCreate();
      if (typeof unsubscribeUpdate === 'function') unsubscribeUpdate();
      if (typeof unsubscribeComplete === 'function') unsubscribeComplete();
      if (typeof unsubscribeFilter === 'function') unsubscribeFilter();
      componentRegistry.unregisterComponent(unregisterKey);
      dataFlow.unregisterNode('task-lists');
      dataFlow.unregisterNode('tasks');
      dataFlow.unregisterNode('task-form-data');
      dataFlow.unregisterNode('view-settings');
    };
  }, [
    communication,
    componentRegistry,
    dataFlow,
    effectiveUserId,
    filterStatus,
    profession,
    projectId,
    selectedTaskList,
    sortBy,
    taskFormData,
    taskLists,
    tasks,
  ]);

  const invalidateTasks = async (listIdOverride?: string) => {
    const activeListId = listIdOverride || selectedTaskList;
    await queryClient.invalidateQueries({ queryKey: ['/api/google-tasks/lists'] });
    if (activeListId) {
      await queryClient.invalidateQueries({ queryKey: ['/api/google-tasks/tasks', activeListId] });
    }
  };

  const createTaskMutation = useMutation<GoogleTask, Error, TaskFormState>({
    mutationFn: async (taskData) => {
      const response = await apiRequest('/api/google-tasks/tasks', {
        method: 'POST',
        body: {
          ...taskData,
          listId: selectedTaskList || undefined,
          profession,
          userId: effectiveUserId,
          projectId,
        },
      });
      return response as GoogleTask;
    },
    onSuccess: async (createdTask) => {
      if (createdTask.listId && createdTask.listId !== selectedTaskList) {
        setSelectedTaskList(createdTask.listId);
      }
      await invalidateTasks(createdTask.listId);
      setCreateTaskOpen(false);
      setEditingTask(null);
      setTaskFormData(createEmptyTaskForm());
    },
  });

  const updateTaskMutation = useMutation<GoogleTask, Error, { taskId: string; taskData: TaskFormState }>({
    mutationFn: async ({ taskId, taskData }) => {
      const response = await apiRequest(`/api/google-tasks/tasks/${taskId}`, {
        method: 'PATCH',
        body: {
          ...taskData,
          listId: selectedTaskList,
          profession,
          userId: effectiveUserId,
          projectId,
        },
      });
      return response as GoogleTask;
    },
    onSuccess: async () => {
      await invalidateTasks();
      setCreateTaskOpen(false);
      setEditingTask(null);
      setTaskFormData(createEmptyTaskForm());
    },
  });

  const completeTaskMutation = useMutation<GoogleTask, Error, string>({
    mutationFn: async (taskId) => {
      const response = await apiRequest(`/api/google-tasks/tasks/${taskId}`, {
        method: 'PATCH',
        body: {
          status: 'completed',
          listId: selectedTaskList,
        },
      });
      return response as GoogleTask;
    },
    onSuccess: async () => {
      await invalidateTasks();
    },
  });

  const deleteTaskMutation = useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (taskId) => {
      const response = await apiRequest(`/api/google-tasks/tasks/${taskId}?listId=${encodeURIComponent(selectedTaskList)}`, {
        method: 'DELETE',
      });
      return response as { success: boolean };
    },
    onSuccess: async () => {
      await invalidateTasks();
    },
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterStatus === 'all') {
        return true;
      }
      return task.status === filterStatus;
    });
  }, [filterStatus, tasks]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((left, right) => {
      if (sortBy === 'due') {
        return (left.due || '').localeCompare(right.due || '');
      }
      if (sortBy === 'updated') {
        return (right.updated || '').localeCompare(left.updated || '');
      }
      return left.position.localeCompare(right.position);
    });
  }, [filteredTasks, sortBy]);

  const selectedTaskListTitle = taskLists.find((taskList) => taskList.id === selectedTaskList)?.title || 'Ingen oppgaveliste valgt';

  const handleOpenCreateDialog = () => {
    setEditingTask(null);
    setTaskFormData(createEmptyTaskForm());
    setCreateTaskOpen(true);
  };

  const handleEditTask = (task: GoogleTask) => {
    setEditingTask(task);
    setTaskFormData({
      title: task.title,
      notes: task.notes || '',
      due: task.due || '',
      parent: task.parent || '',
    });
    setCreateTaskOpen(true);
  };

  const handleSubmitTask = () => {
    if (!taskFormData.title.trim()) {
      return;
    }

    if (editingTask) {
      updateTaskMutation.mutate({ taskId: editingTask.id, taskData: taskFormData });
      return;
    }

    createTaskMutation.mutate(taskFormData);
  };

  const handleFilterChange = (event: SelectChangeEvent) => {
    const nextValue = event.target.value;
    if (nextValue === 'all' || nextValue === 'needsAction' || nextValue === 'completed') {
      setFilterStatus(nextValue);
    }
  };

  const handleSortChange = (event: SelectChangeEvent) => {
    const nextValue = event.target.value;
    if (nextValue === 'position' || nextValue === 'due' || nextValue === 'updated') {
      setSortBy(nextValue);
    }
  };

  const handleTaskListChange = (event: SelectChangeEvent) => {
    setSelectedTaskList(event.target.value);
  };

  const hasTaskMutationPending =
    createTaskMutation.isPending ||
    updateTaskMutation.isPending ||
    completeTaskMutation.isPending ||
    deleteTaskMutation.isPending;

  return (
    <Box sx={{ p: 3 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1.5 }}
          >
            <Task sx={{ fontSize: 36 }} />
            Google Tasks
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Oppgaver fra samme Google-økt, koblet til prosjekt, profesjon og CRM-kontekst.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
            <Chip size="small" color="primary" variant="outlined" label={`Bruker: ${effectiveUserId}`} />
            <Chip size="small" variant="outlined" label={`Profesjon: ${profession}`} />
            {projectId ? (
              <Chip size="small" color="success" variant="outlined" label={`Prosjekt: ${projectId}`} />
            ) : (
              <Chip size="small" color="warning" variant="outlined" label="Ingen prosjektkontekst" />
            )}
          </Stack>
        </Box>

        <Stack direction="row" spacing={1}>
          <Tooltip title="Oppdater task lists og oppgaver">
            <span>
              <IconButton
                color="primary"
                onClick={() => {
                  void refetchTaskLists();
                  if (selectedTaskList) {
                    void refetchTasks();
                  }
                }}
                disabled={listsFetching || tasksFetching}
              >
                <Refresh />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenCreateDialog}
            disabled={hasTaskMutationPending}
            sx={theming.getThemedButtonSx()}
          >
            Ny oppgave
          </Button>
        </Stack>
      </Stack>

      {(taskListsError || tasksError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {taskListsError?.message || tasksError?.message || 'Kunne ikke hente Google Tasks-data.'}
        </Alert>
      )}

      <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
            <FormControl fullWidth>
              <InputLabel>Oppgaveliste</InputLabel>
              <Select
                value={selectedTaskList}
                label="Oppgaveliste"
                onChange={handleTaskListChange}
                disabled={listsLoading}
              >
                {taskLists.map((taskList) => (
                  <MenuItem key={taskList.id} value={taskList.id}>
                    {taskList.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select value={filterStatus} label="Status" onChange={handleFilterChange}>
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="needsAction">Aktive</MenuItem>
                <MenuItem value="completed">Fullførte</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 140 }}>
              <InputLabel>Sorter</InputLabel>
              <Select value={sortBy} label="Sorter" onChange={handleSortChange}>
                <MenuItem value="position">Posisjon</MenuItem>
                <MenuItem value="due">Frist</MenuItem>
                <MenuItem value="updated">Oppdatert</MenuItem>
              </Select>
            </FormControl>
            <Chip
              color="primary"
              variant="outlined"
              label={`${filteredTasks.length} oppgaver i ${selectedTaskListTitle}`}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card sx={theming.getThemedCardSx()}>
        <CardContent>
          {listsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : tasksLoading && selectedTaskList ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : sortedTasks.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <Task sx={{ fontSize: 60, color: 'text.disabled', mb: 1.5 }} />
              <Typography variant="h6" sx={{ mb: 0.5 }}>
                {taskLists.length === 0 ? 'Ingen Google Tasks-lister funnet' : 'Ingen oppgaver i denne listen'}
              </Typography>
              <Typography color="text.secondary">
                {taskLists.length === 0
                  ? 'Første oppgave oppretter automatisk en CreatorHub-liste i Google Tasks.'
                  : 'Opprett en ny oppgave for å starte oppfølgingen.'}
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {sortedTasks.map((task, index) => (
                <React.Fragment key={task.id}>
                  <ListItem sx={{ alignItems: 'flex-start', py: 2, px: 0 }}>
                    <Checkbox
                      checked={task.status === 'completed'}
                      onChange={() => completeTaskMutation.mutate(task.id)}
                      disabled={completeTaskMutation.isPending}
                      sx={{ mt: 0.5, mr: 1 }}
                    />
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography
                            variant="body1"
                            sx={{
                              textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                              opacity: task.status === 'completed' ? 0.65 : 1,
                              fontWeight: 600,
                            }}
                          >
                            {task.title}
                          </Typography>
                          {task.due ? (
                            <Chip
                              size="small"
                              color="warning"
                              variant="outlined"
                              icon={<Schedule fontSize="small" />}
                              label={new Date(task.due).toLocaleString('nb-NO', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            />
                          ) : null}
                        </Stack>
                      }
                      secondary={
                        <Box sx={{ mt: 0.75 }}>
                          {task.notes ? (
                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', mb: 0.75 }}>
                              {task.notes}
                            </Typography>
                          ) : null}
                          <Typography variant="caption" color="text.secondary">
                            Oppdatert {task.updated ? new Date(task.updated).toLocaleString('nb-NO') : 'ukjent tidspunkt'}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={1}>
                        <IconButton color="primary" size="small" onClick={() => handleEditTask(task)}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton color="error" size="small" onClick={() => deleteTaskMutation.mutate(task.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < sortedTasks.length - 1 ? <Divider /> : null}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Dialog open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTask ? 'Rediger Google Task' : 'Ny Google Task'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Tittel"
            fullWidth
            value={taskFormData.title}
            onChange={(event) => setTaskFormData((current) => ({ ...current, title: event.target.value }))}
            sx={{ mt: 1, mb: 2 }}
            required
          />
          <TextField
            label="Notater"
            fullWidth
            multiline
            rows={4}
            value={taskFormData.notes}
            onChange={(event) => setTaskFormData((current) => ({ ...current, notes: event.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Frist"
            type="datetime-local"
            fullWidth
            value={taskFormData.due}
            onChange={(event) => setTaskFormData((current) => ({ ...current, due: event.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateTaskOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleSubmitTask}
            disabled={!taskFormData.title.trim() || createTaskMutation.isPending || updateTaskMutation.isPending}
            sx={theming.getThemedButtonSx()}
          >
            {editingTask ? 'Oppdater' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GoogleTasksIntegration;
