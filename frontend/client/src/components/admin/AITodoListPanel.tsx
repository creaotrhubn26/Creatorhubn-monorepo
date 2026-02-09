/**
 * AI Todo List Panel
 * 
 * Features:
 * - Displays AI-generated todo lists
 * - Shows dependencies between todos
 * - Tracks completion progress
 * - Highlights what, 's blocked and why
 * - Shows "completing this enables X" benefits
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  LinearProgress,
  Alert,
  AlertTitle,
  Paper,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import {
  CheckCircle as DoneIcon,
  RadioButtonUnchecked as PendingIcon,
  Block as BlockedIcon,
  PlayArrow as InProgressIcon,
  ExpandMore as ExpandIcon,
  Info as InfoIcon,
  TrendingFlat as ArrowIcon,
  Lock as LockIcon,
  LockOpen as UnlockedIcon,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';

interface AITodoListPanelProps {
  todoGroupId?: string;
  autoRefresh?: boolean;
}

export const AITodoListPanel: React.FC<AITodoListPanelProps> = ({ 
  todoGroupId,
  autoRefresh = false 
}) => {
  const theming = useTheming('prototype_tester');
  const { componentRegistry, communication, analytics, auth } = useEnhancedMasterIntegration();
  
  const [todoGroup, setTodoGroup] = useState<any>(null);
  const [nextTodos, setNextTodos] = useState<any[]>([]);
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set());

  // Register component
  useEffect(() => {
    componentRegistry.registerComponent({
      id: 'ai-todo-list-panel',
      name: 'AI Todo List Panel',
      type: 'admin',
      category: 'task-management',
      capabilities: ['todos','todo-completed','update','panel','task-management'],
      dependencies: ['openai-api'],
      props: [],
      events: ['todo-completed'],
      dataKeys: ['todos','todo-group'],
      version: '1.0.0',
      description: 'AI-generated todo list panel with dependency tracking'
    });

    return () => componentRegistry.unregisterComponent('ai-todo-list-panel');
}, [componentRegistry]);

  // Load todo group
  useEffect(() => {
    if (todoGroupId) {
      loadTodoGroup();
  }
}, [todoGroupId]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && todoGroupId) {
      const interval = setInterval(loadTodoGroup, 5000);
      return () => clearInterval(interval);
  }
}, [autoRefresh, todoGroupId]);

  // Listen for new todo groups from code generation
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'code-generation:complete' && message.data.todoGroup) {
        setTodoGroup(message.data.todoGroup);
        analytics.trackEvent('ai_todos_generated', {
          service: message.data.provider,
          todoCount: message.data.todoGroup.totalTodos,
      });
    }
  });

    return unsubscribe;
}, [communication, analytics]);

  const loadTodoGroup = async () => {
    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest(`/api/admin/todos/${todoGroupId}`, { headers });
      if (response.success) {
        setTodoGroup(response.todoGroup);

        // Load next actionable todos
        const nextResponse = await apiRequest(`/api/admin/todos/${todoGroupId}/next`, { headers });
        if (nextResponse.success) {
          setNextTodos(nextResponse.nextTodos);
      }
    }
  } catch (error) {
      console.error('Failed to load todo group: ', error);
  }
};

  const handleToggleTodo = async (todoId: string) => {
    if (!todoGroup) return;

    const todo = todoGroup.todos.find((t: any) => t.id === todoId);
    if (!todo) return;

    const newStatus = todo.status === 'completed' ? 'pending' : 'completed';

    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest(`/api/admin/todos/${todoGroup.id}/${todoId}`, {
        headers,
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
    });

      if (response.success) {
        setTodoGroup(response.todoGroup);
        
        analytics.trackEvent('todo_status_updated', {
          todoId,
          newStatus,
          groupId: todoGroup.id,
      });

        communication.sendBroadcast('todo:status:changed', {
          todoId,
          status: newStatus,
          todoGroup: response.todoGroup,
      });
    }
  } catch (error) {
      console.error('Failed to update todo:', error);
  }
};

  const toggleExpanded = (todoId: string) => {
    const newExpanded = new Set(expandedTodos);
    if (newExpanded.has(todoId)) {
      newExpanded.delete(todoId);
  } else {
      newExpanded.add(todoId);
  }
    setExpandedTodos(newExpanded);
};

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
  }
};

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'hard': return 'error';
      case 'medium': return 'warning';
      case 'easy': return 'success';
      default: return 'default';
  }
};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <DoneIcon color="success" />;
      case 'in_progress': return <InProgressIcon color="primary" />;
      case 'blocked': return <BlockedIcon color="error" />;
      default: return <PendingIcon color="action" />;
  }
};

  if (!todoGroup) {
    return (
      <Alert severity="info">
        <AlertTitle>No Active Todo List</AlertTitle>
        <Typography variant="body2">
          Todos will appear automatically when you:
        </Typography>
        <Box component="ul" sx={{ mt: 1 }}>
          <li>Add an API key (auto-generates integration todos)</li>
          <li>Scan for linting errors (auto-generates fix todos)</li>
          <li>Start a new feature (auto-generates implementation todos)</li>
        </Box>
      </Alert>
    );
}

  return (
    <Box>
      {/* Header with Progress */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title={
            <Box>
              <Typography variant="h5">{todoGroup.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {todoGroup.description}
              </Typography>
            </Box>
        }
        />
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">
                Progress: {todoGroup.completedTodos}/{todoGroup.totalTodos} todos completed
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {todoGroup.progress}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={todoGroup.progress} 
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={3}>
              <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'success.light' }}>
                <Typography variant="h4" sx={{ color: 'success.contrastText' }}>
                  {todoGroup.completedTodos}
                </Typography>
                <Typography variant="caption" sx={{ color: 'success.contrastText' }}>
                  Completed
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={3}>
              <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'primary.light' }}>
                <Typography variant="h4" sx={{ color: 'primary.contrastText' }}>
                  {nextTodos.length}
                </Typography>
                <Typography variant="caption" sx={{ color: 'primary.contrastText' }}>
                  Next Up
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={3}>
              <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'warning.light' }}>
                <Typography variant="h4" sx={{ color: 'warning.contrastText' }}>
                  {todoGroup.todos.filter((t: any) => t.status === 'blocked').length}
                </Typography>
                <Typography variant="caption" sx={{ color: 'warning.contrastText' }}>
                  Blocked
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={3}>
              <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'info.light' }}>
                <Typography variant="h4" sx={{ color: 'info.contrastText' }}>
                  {todoGroup.totalTodos - todoGroup.completedTodos}
                </Typography>
                <Typography variant="caption" sx={{ color: 'info.contrastText' }}>
                  Remaining
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Next Actionable Todos */}
      {nextTodos.length > 0 && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <AlertTitle>✅ {nextTodos.length} Todos Ready to Start</AlertTitle>
          <Typography variant="body2">
            These todos have all dependencies completed and can be started now:
          </Typography>
          <Box component="ul" sx={{ mt: 1, mb: 0 }}>
            {nextTodos.map(todo => (
              <li key={todo.id}>
                <strong>{todo.title}</strong> ({todo.estimatedTime})
              </li>
            ))}
          </Box>
        </Alert>
      )}

      {/* Todo List by Category */}
      {['setup','coding','testing', 'documentation', 'deployment'].map(category => {
        const categoryTodos = todoGroup.todos.filter((t: any) => t.category === category);
        if (categoryTodos.length === 0) return null;

        return (
          <Card key={category} sx={{ mb: 2 }}>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip 
                    label={category.toUpperCase()} 
                    size="small" 
                    color="primary" 
                  />
                  <Typography>
                    {categoryTodos.filter((t: any) => t.status === 'completed').length}/{categoryTodos.length} completed
                  </Typography>
                </Box>
            }
            />
            <CardContent>
              <List>
                {categoryTodos.map((todo: any) => {
                  const isBlocked = todo.dependencies.some((depId: string) =>
                    todoGroup.todos.find((t: any) => t.id === depId)?.status !== 'completed'
                  );

                  return (
                    <Accordion 
                      key={todo.id}
                      expanded={expandedTodos.has(todo.id)}
                      onChange={() => toggleExpanded(todo.id)}
                    >
                      <AccordionSummary>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                          <Checkbox
                            checked={todo.status === 'completed'}
                            onChange={() => handleToggleTodo(todo.id)}
                            disabled={isBlocked}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {getStatusIcon(todo.status)}
                          <Typography sx={{ flex: 1 }}>
                            {todo.title}
                          </Typography>
                          <Chip 
                            label={todo.priority} 
                            size="small" 
                            color={getPriorityColor(todo.priority) as any}
                          />
                          <Chip 
                            label={todo.estimatedTime} 
                            size="small" 
                            variant="outlined"
                          />
                          {isBlocked && <LockIcon color="error" />}
                          {!isBlocked && <UnlockedIcon color="success" />}
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box>
                          {/* Description */}
                          <Typography variant="body2" gutterBottom>
                            {todo.description}
                          </Typography>

                          <Divider sx={{ my: 2 }} />

                          {/* Metadata */}
                          <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">
                                Difficulty:
                              </Typography>
                              <br />
                              <Chip 
                                label={todo.difficulty} 
                                size="small" 
                                color={getDifficultyColor(todo.difficulty) as any}
                              />
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">
                                Estimated Time:
                              </Typography>
                              <br />
                              <Chip label={todo.estimatedTime} size="small" />
                            </Grid>
                          </Grid>

                          {/* Dependencies */}
                          {todo.dependencies && todo.dependencies.length > 0 && (
                            <Paper sx={{ p: 2, mb: 2, bgcolor: 'warning.light' }}>
                              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.contrastText' }}>
                                <LockIcon fontSize="small" />
                                Dependencies (Must Complete These First)
                              </Typography>
                              <List dense>
                                {todo.dependencies.map((depId: string) => {
                                  const depTodo = todoGroup.todos.find((t: any) => t.id === depId);
                                  return (
                                    <ListItem key={depId}>
                                      <ListItemIcon>
                                        {depTodo?.status === 'completed' ? (
                                          <DoneIcon color="success" fontSize="small" />
                                        ) : (
                                          <PendingIcon color="action" fontSize="small" />
                                        )}
                                      </ListItemIcon>
                                      <ListItemText 
                                        primary={depTodo?.title || depId}
                                        primaryTypographyProps={{ 
                                          sx: { color: 'warning.contrastText' },
                                          variant: 'body2' 
                                      }}
                                      />
                                    </ListItem>
                                  );
                              })}
                              </List>
                            </Paper>
                          )}

                          {/* Blocked By */}
                          {todo.blockedBy && todo.blockedBy.length > 0 && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                              <AlertTitle>🔒 Blocked</AlertTitle>
                              {todo.blockedBy.map((reason: string, i: number) => (
                                <Typography key={i} variant="body2">
                                  • {reason}
                                </Typography>
                              ))}
                            </Alert>
                          )}

                          {/* What It Enables */}
                          {todo.whatItEnables && todo.whatItEnables.length > 0 && (
                            <Paper sx={{ p: 2, mb: 2, bgcolor: 'success.light' }}>
                              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.contrastText' }}>
                                <ArrowIcon fontSize="small" />
                                Completing This Will Enable:
                              </Typography>
                              <List dense>
                                {todo.whatItEnables.map((benefit: string, i: number) => (
                                  <ListItem key={i}>
                                    <ListItemIcon>
                                      <DoneIcon color="success" fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText 
                                      primary={benefit}
                                      primaryTypographyProps={{ 
                                        sx: { color: 'success.contrastText' },
                                        variant: 'body2' 
                                    }}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            </Paper>
                          )}

                          {/* Code Snippet */}
                          {todo.codeSnippet && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                💻 Code Example:
                              </Typography>
                              <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'white' }}>
                                <Typography 
                                  component="pre" 
                                  sx={{ 
                                    fontFamily: 'monospace', 
                                    fontSize: '0.85rem',
                                    whiteSpace: 'pre-wrap',
                                    margin: 0 
                                }}
                                >
                                  {todo.codeSnippet}
                                </Typography>
                              </Paper>
                            </Box>
                          )}

                          {/* Related Files */}
                          {todo.relatedFiles && todo.relatedFiles.length > 0 && (
                            <Box>
                              <Typography variant="subtitle2" gutterBottom>
                                📁 Related Files:
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap:'wrap' }}>
                                {todo.relatedFiles.map((file: string, i: number) => (
                                  <Chip
                                    key={i}
                                    label={file.split('/').pop()}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  );
              })}
              </List>
            </CardContent>
          </Card>
        );
    })}
    </Box>
  );
};

export default AITodoListPanel;

