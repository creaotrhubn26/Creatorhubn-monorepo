import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Checkbox,
  Chip,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Task,
  Add,
  Edit,
  Delete,
  CheckCircle,
  RadioButtonUnchecked,
  Schedule,
  Flag,
  Star,
  StarBorder,
  MoreVert,
  Refresh,
  FilterList,
  Sort,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';

interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  position: string;
  parent?: string;
  links?: Array<{
    type: string;
    link: string;
}>;
  selfLink: string;
  updated: string
}

interface GoogleTaskList {
  id: string;
  title: string;
  selfLink: string;
  updated: string
}

interface GoogleTasksIntegrationProps {
  profession: string;
  userId: string;
  projectId?: string
}

const GoogleTasksIntegration: React.FC<GoogleTasksIntegrationProps> = ({
  profession,
  userId,
  projectId
}) => {
  const [selectedTaskList, setSelectedTaskList] = useState<string>('');
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<GoogleTask | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'needsAction' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'position' | 'due' | 'updated'>('position');
  const [taskFormData, setTaskFormData] = useState({
    title: ',',
    notes: '',
    due: '',
    parent: ''
});

  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry, auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('photographer');

  // Register component with MasterIntegrationProvider
  React.useEffect(() => {
    componentRegistry.registerComponent('GoogleTasksIntegration', {
      type: 'google-service',
      capabilities: ['task-management','task-list-management','task-sync','project-integration'],
      dataFlow: {
        sources: ['task-lists','tasks','task-form-data','view-settings'],
        destinations: ['admin-dashboard','user-interface','project-system'],
        processors: ['task-processing','sync-processing'],
      },
    });

    // Set up data flow nodes
    dataFlow.registerNode('task-lists', {
      type: 'source',
      data: taskLists,
      metadata: { component: 'GoogleTasksIntegration', type: 'task-lists' }
  });

    dataFlow.registerNode('tasks', {
      type: 'source',
      data: tasks,
      metadata: { component: 'GoogleTasksIntegration', type: 'tasks' }
  });

    dataFlow.registerNode('task-form-data', {
      type: 'source',
      data: taskFormData,
      metadata: { component: 'GoogleTasksIntegration', type: 'task-form-data' }
  });

    dataFlow.registerNode('view-settings', {
      type: 'source',
      data: { selectedTaskList, filterStatus, sortBy },
      metadata: { component: 'GoogleTasksIntegration', type: 'view-settings' }
  });

    // Listen for Google Tasks events
    communication.subscribe('google-tasks: create-task', (data) => {
      if (data.taskData) {
        setTaskFormData(data.taskData);
        setCreateTaskOpen(true);
    }
  });

    communication.subscribe('google-tasks: update-task', (data) => {
      if (data.task) {
        setEditingTask(data.task);
        setCreateTaskOpen(true);
    }
  });

    communication.subscribe('google-tasks: complete-task', (data) => {
      if (data.taskId) {
        completeTaskMutation.mutate(data.taskId);
    }
  });

    communication.subscribe('google-tasks: filter-change', (data) => {
      if (data.filterStatus) {
        setFilterStatus(data.filterStatus);
    }
  });

    return () => {
      componentRegistry.unregisterComponent('GoogleTasksIntegration');
      dataFlow.unregisterNode('task-lists');
      dataFlow.unregisterNode('tasks');
      dataFlow.unregisterNode('task-form-data');
      dataFlow.unregisterNode('view-settings');
  };
}, [taskLists, tasks, taskFormData, selectedTaskList, filterStatus, sortBy, componentRegistry, dataFlow, communication]);

  // Fetch Google Tasks lists
  const { data: taskLists = [], isLoading: listsLoading } = useQuery({
    queryKey: ['/api/google-tasks/lists'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return (await apiRequest('/api/google-tasks/lists', { headers })) || [];
    },
    staleTime: 2 * 60 * 100,
  });

  // Fetch tasks from selected list
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['/api/google-tasks/tasks', selectedTaskList],
    queryFn: async () => {
      if (!selectedTaskList) return [];
      const headers = await auth.getAuthHeader();
      return (
        (await apiRequest(`/api/google-tasks/lists/${selectedTaskList}/tasks`, { headers })) || []
      );
    },
    enabled: !!selectedTaskList,
    staleTime: 2 * 60 * 100,
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      const headers = await auth.getAuthHeader();
      return await apiRequest(`/api/google-tasks/lists/${selectedTaskList}/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify(taskData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-tasks/tasks', selectedTaskList] });
      setCreateTaskOpen(false);
      setTaskFormData({ title: '', notes: ',', due: '', parent: ',' });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, taskData }: { taskId: string; taskData: any }) => {
      const headers = await auth.getAuthHeader();
      return await apiRequest(`/api/google-tasks/tasks/${taskId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ ...taskData, listId: selectedTaskList }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-tasks/tasks', selectedTaskList] });
      setCreateTaskOpen(false);
      setEditingTask(null);
      setTaskFormData({ title: '', notes: ',', due: '', parent: ',' });
    },
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const headers = await auth.getAuthHeader();
      return await apiRequest(`/api/google-tasks/tasks/${taskId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'completed', listId: selectedTaskList }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-tasks/tasks', selectedTaskList] });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const headers = await auth.getAuthHeader();
      return await apiRequest(`/api/google-tasks/tasks/${taskId}?listId=${selectedTaskList}`, {
        method: 'DELETE',
        headers,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-tasks/tasks', selectedTaskList] });
    },
  });

  const handleCreateTask = () => {
    if (editingTask) {
      updateTaskMutation.mutate({
        taskId: editingTask.id,
        taskData: taskFormData,
      });
    } else {
      createTaskMutation.mutate(taskFormData);
    }
  };

  const handleEditTask = (task: GoogleTask) => {
    setEditingTask(task);
    setTaskFormData({
      title: task.title,
      notes: task.notes ||'',
      due: task.due ||'',
      parent: task.parent ||'',
  });
    setCreateTaskOpen(true);
};

  const handleCompleteTask = (task: GoogleTask) => {
    completeTaskMutation.mutate(task.id);
};

  const handleDeleteTask = (task: GoogleTask) => {
    deleteTaskMutation.mutate(task.id);
};

  const filteredTasks = tasks.filter((task: GoogleTask) => {
    if (filterStatus === 'all') return true;
    return task.status === filterStatus;
});

  const sortedTasks = [...filteredTasks].sort((a: GoogleTask, b: GoogleTask) => {
    switch (sortBy) {
      case 'due':
        return (a.due || ', ').localeCompare(b.due || ', ');
      case 'updated':
        return b.updated.localeCompare(a.updated);
      default:
        return a.position.localeCompare(b.position);
}
});

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h4" sx={{  fontWeight: 600, color: '#1976d0', display: 'flex', alignItems: 'center'  }}>
          <Task sx={{ mr: 2, fontSize: 40}} />
          Google Tasks
        </Typography>
        <Button
          variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={() => {
            setEditingTask(null);
            setTaskFormData({ title: ', ', notes: ', ', due: ', ', parent: ', ' });
            setCreateTaskOpen(true);
          }}
          disabled={!selectedTaskList}
          sx={theming.getThemedButtonSx()}
        >
          Ny oppgave
        </Button>
      </Box>

      {/* Task List Selection */}
      <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
        <CardContent>
          <Typography variant="h6" sx={{  mb:  2  }}>
            Velg oppgaveliste
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Oppgaveliste</InputLabel>
            <Select
              value={selectedTaskList}
              label="Oppgaveliste"
              onChange={(e) => setSelectedTaskList(e.target.value)}
            >
              {taskLists.map((list: GoogleTaskList) => (
                <MenuItem key={list.id} value={list.id}>
                  {list.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Filters and Controls */}
      {selectedTaskList && (
        <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 120}}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  label="Status"
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                >
                  <MenuItem value="all">Alle</MenuItem>
                  <MenuItem value="needsAction">Aktive</MenuItem>
                  <MenuItem value="completed">Fullført</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120}}>
                <InputLabel>Sorter</InputLabel>
                <Select
                  value={sortBy}
                  label="Sorter"
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <MenuItem value="position">Posisjon</MenuItem>
                  <MenuItem value="due">Frist</MenuItem>
                  <MenuItem value="updated">Oppdatert</MenuItem>
                </Select>
              </FormControl>
              <Chip
                label={`${filteredTasks.length} oppgaver`}
                color="primary"
                variant="outlined"
              />
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Tasks List */}
      {selectedTaskList ? (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent>
            {tasksLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p:  3 }}>
                <CircularProgress />
              </Box>
            ) : sortedTasks.length === 0 ? (
              <Box sx={{ textAlign: 'center', p:  4 }}>
                <Task sx={{ fontSize:  60, color: 'grey.40', mb:  2 }} />
                <Typography color="text.secondary" variant="h6" sx={{ color: theming.colors.primary }}>
                  Ingen oppgaver funnet
                </Typography>
                <Typography color="text.secondary">
                  {filterStatus === 'all' ? 'Opprett din første oppgave' : 'Ingen oppgaver med denne statusen'}
                </Typography>
              </Box>
            ) : (
              <List>
                {sortedTasks.map((task: GoogleTask, index: number) => (
                  <React.Fragment key={task.id}>
                    <ListItem sx={{ alignItems: 'flex-start', py:  2 }}>
                      <Checkbox
                        checked={task.status === 'completed'}
                        onChange={() => handleCompleteTask(task)}
                        color="primary"
                        sx={{ mr: 2, mt: 0.5}}
                      />
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography
                              variant="body1"
                              sx={{
                                textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                                opacity: task.status === 'completed' ? 0.6 : 1}}
                            >
                              {task.title}
                            </Typography>
                            {task.due && (
                              <Chip
                                label={new Date(task.due).toLocaleDateString('nb-NO')}
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            )}
                          </Box>
                      }
                        secondary={
                          <Box>
                            {task.notes && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                                {task.notes}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              Oppdatert: {new Date(task.updated).toLocaleDateString('nb-NO', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Typography>
                          </Box>
                      }
                      />
                      <ListItemSecondaryAction>
                        <Stack direction="row" spacing={1}>
                          <IconButton
                            onClick={() => handleEditTask(task)}
                            size="small"
                            color="primary"
                          >
                            {theming.getThemedIcon('edit')}
                          </IconButton>
                          <IconButton
                            onClick={() => handleDeleteTask(task)}
                            size="small"
                            color="error"
                          >
                            {theming.getThemedIcon('delete')}
                          </IconButton>
                        </Stack>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < sortedTasks.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info">
          Velg en oppgaveliste for å se oppgaver
        </Alert>
      )}

      {/* Create/Edit Task Dialog */}
      <Dialog open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTask ? 'Rediger oppgave' : 'Ny oppgave'}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Tittel"
            fullWidth
            value={taskFormData.title}
            onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
            sx={{ mb: 2, mt: 1 }}
            required
          />
          <TextField
            label="Notater"
            multiline
            rows={3}
            fullWidth
            value={taskFormData.notes}
            onChange={(e) => setTaskFormData({ ...taskFormData, notes: e.target.value })}
            sx={{ mb:  2 }}
          />
          <TextField
            label="Frist"
            type="datetime-local"
            fullWidth
            value={taskFormData.due}
            onChange={(e) => setTaskFormData({ ...taskFormData, due: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ mb:  2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateTaskOpen(false)}>
            Avbryt
          </Button>
          <Button onClick={handleCreateTask}
            variant="contained"
            disabled={!taskFormData.title.trim() || createTaskMutation.isPending || updateTaskMutation.isPending}
           sx={theming.getThemedButtonSx()}>
            {editingTask ? 'Oppdater' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GoogleTasksIntegration;
