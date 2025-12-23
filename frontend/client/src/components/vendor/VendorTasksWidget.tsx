import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Checkbox,
  Chip,
  LinearProgress,
  Button,
  Collapse,
  IconButton,
  Alert,
  Divider,
  alpha,
  useTheme
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Star,
  Store,
  Payment,
  Image,
  Settings,
  Launch,
  TrendingUp,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Celebration,
  Lightbulb,
  Business,
  Category,
  Inventory,
  LocalShipping
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { getVendorTypeConfig } from '@shared/vendor-type-registry';

interface VendorTasksWidgetProps {
  vendorType: string;
  vendorName: string;
  userId: string;
  compact?: boolean;
  onTaskComplete?: (taskId: string) => void;
  onTaskClick?: (taskId: string) => void;
}

interface VendorTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  icon: React.ReactNode;
  action?: string;
  actionLabel?: string;
  currentProgress?: number;
  targetProgress?: number;
  category: 'onboarding' | 'growth' | 'optimization' | 'maintenance';
  estimatedTime?: string;
  benefits?: string[];
}

export default function VendorTasksWidget({
  vendorType,
  vendorName,
  userId,
  compact = false,
  onTaskComplete,
  onTaskClick
}: VendorTasksWidgetProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const vendorConfig = getVendorTypeConfig(vendorType);

  // Fetch vendor tasks and progress
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['/api/vendor-tasks', vendorType, vendorName, userId],
    queryFn: () => apiRequest(`/api/vendor-tasks/${vendorType}/${vendorName}/${userId}`)
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) =>
      apiRequest('/api/vendor-tasks/complete', {
        method: 'POST',
        body: { vendorType, vendorName, userId, taskId }
      }),
    onSuccess: (data, taskId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-tasks'] });
      if (onTaskComplete) {
        onTaskComplete(taskId);
      }
    }
  });

  const getTaskIcon = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
      store: <Store />,
      payment: <Payment />,
      image: <Image />,
      settings: <Settings />,
      launch: <Launch />,
      trending: <TrendingUp />,
      star: <Star />,
      business: <Business />,
      category: <Category />,
      inventory: <Inventory />,
      shipping: <LocalShipping />
    };
    return icons[iconName] || <CheckCircle />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#f44336';
      case 'medium':
        return '#ff9800';
      case 'low':
        return '#4caf50';
      default:
        return '#9e9e9e';
    }
  };

  const tasks: VendorTask[] = tasksData?.tasks || [
    {
      id: 'storefront_setup',
      title: 'Fullfør butikkoppsett',
      description: 'Legg til logo, beskrivelse og kontaktinformasjon',
      completed: tasksData?.storefrontComplete || false,
      priority: 'high',
      icon: getTaskIcon('store'),
      action: 'setup_storefront',
      actionLabel: 'Fullfør oppsett',
      category: 'onboarding',
      estimatedTime: '5 min',
      benefits: ['Økt tillit hos kunder', 'Profesjonelt utseende']
    },
    {
      id: 'first_products',
      title: 'Legg til dine første 3 produkter',
      description: `${tasksData?.productCount || 0}/3 produkter lagt til`,
      completed: (tasksData?.productCount || 0) >= 3,
      priority: 'high',
      icon: getTaskIcon('category'),
      action: 'add_products',
      actionLabel: 'Legg til produkt',
      currentProgress: tasksData?.productCount || 0,
      targetProgress: 3,
      category: 'onboarding',
      estimatedTime: '15 min',
      benefits: ['Start salg umiddelbart', 'Synlighet i markedsplass']
    },
    {
      id: 'payout_method',
      title: 'Sett opp betalingsmetode',
      description: 'Konfigurer Stripe eller bankoverføring',
      completed: tasksData?.payoutMethodSet || false,
      priority: 'high',
      icon: getTaskIcon('payment'),
      action: 'setup_payment',
      actionLabel: 'Sett opp betaling',
      category: 'onboarding',
      estimatedTime: '10 min',
      benefits: ['Motta betalinger', 'Automatisk fakturering']
    },
    {
      id: 'showcase_setup',
      title: 'Opprett showcase',
      description: 'Vis frem dine beste produkter',
      completed: tasksData?.showcaseCreated || false,
      priority: 'medium',
      icon: getTaskIcon('star'),
      action: 'create_showcase',
      actionLabel: 'Opprett showcase',
      category: 'growth',
      estimatedTime: '10 min',
      benefits: ['Økt synlighet', 'Attraktive produktvisninger']
    },
    {
      id: 'inventory_setup',
      title: 'Konfigurer lagerstyring',
      description: 'Sett minimumsnivåer og lagervarsler',
      completed: tasksData?.inventorySetup || false,
      priority: 'medium',
      icon: getTaskIcon('inventory'),
      action: 'setup_inventory',
      actionLabel: 'Sett opp lager',
      category: 'optimization',
      estimatedTime: '8 min',
      benefits: ['Unngå tomt lager', 'Automatiske varsler']
    },
    {
      id: 'first_sale',
      title: 'Gjør ditt første salg',
      description: 'Mål: 1 salg',
      completed: (tasksData?.totalSales || 0) >= 1,
      priority: 'high',
      icon: getTaskIcon('trending'),
      category: 'growth',
      currentProgress: tasksData?.totalSales || 0,
      targetProgress: 1,
      estimatedTime: 'Varierer',
      benefits: ['Bygge momentum', 'Validere produkter']
    },
    {
      id: 'reach_10_products',
      title: 'Nå 10 produkter',
      description: `${tasksData?.productCount || 0}/10 produkter`,
      completed: (tasksData?.productCount || 0) >= 10,
      priority: 'medium',
      icon: getTaskIcon('store'),
      action: 'add_products',
      actionLabel: 'Legg til flere',
      category: 'growth',
      currentProgress: tasksData?.productCount || 0,
      targetProgress: 10,
      estimatedTime: '30 min',
      benefits: ['Bredere produktutvalg', 'Økt oppdagelse']
    }
  ];

  // Add vendor-specific tasks
  if (vendorConfig?.supportedFeatures.physical_shipping && !tasksData?.shippingSetup) {
    tasks.push({
      id: 'shipping_setup',
      title: 'Konfigurer frakt',
      description: 'Sett opp fraktalternativer og priser',
      completed: tasksData?.shippingSetup || false,
      priority: 'medium',
      icon: getTaskIcon('shipping'),
      action: 'setup_shipping',
      actionLabel: 'Sett opp frakt',
      category: 'optimization',
      estimatedTime: '12 min',
      benefits: ['Fleksible fraktalternativer', 'Økt kundetilfredshet']
    });
  }

  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const progress = (completedTasks.length / tasks.length) * 100;

  const handleTaskClick = (task: VendorTask) => {
    if (task.action && onTaskClick) {
      onTaskClick(task.action);
    }
  };

  const handleToggleTask = (taskId: string) => {
    completeTaskMutation.mutate(taskId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <LinearProgress />
          <Typography sx={{ mt: 2, textAlign: 'center' }}>Laster oppgaver...</Typography>
        </CardContent>
      </Card>
    );
  }

  // Celebration state when all tasks complete
  const allTasksComplete = activeTasks.length === 0;

  if (compact) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Lightbulb sx={{ color: vendorConfig?.color || '#ff9800' }} />
              Oppgaver
            </Typography>
            <Chip
              label={`${completedTasks.length}/${tasks.length}`}
              size="small"
              sx={{
                bgcolor: alpha(vendorConfig?.color || '#ff9800', 0.2),
                color: vendorConfig?.color || '#ff9800',
                fontWeight: 600
              }}
            />
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: alpha(vendorConfig?.color || '#ff9800', 0.1),
              '& .MuiLinearProgress-bar': {
                bgcolor: vendorConfig?.color || '#ff9800'
              }
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {Math.round(progress)}% fullført
          </Typography>
          {activeTasks.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Neste:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {activeTasks[0].title}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card component="section" aria-labelledby="tasks-heading">
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Lightbulb sx={{ color: vendorConfig?.color || '#ff9800', fontSize: 28 }} aria-hidden="true" />
            <Typography variant="h6" component="h2" id="tasks-heading" sx={{ fontWeight: 600 }}>
              Dine oppgaver
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={`${completedTasks.length}/${tasks.length} fullført`}
              aria-label={`${completedTasks.length} av ${tasks.length} oppgaver fullført`}
              sx={{
                bgcolor: alpha(vendorConfig?.color || '#ff9800', 0.2),
                color: vendorConfig?.color || '#ff9800',
                fontWeight: 600
              }}
            />
            <IconButton 
              size="small" 
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? 'Skjul oppgaver' : 'Vis oppgaver'}
              aria-expanded={expanded}
              aria-controls="tasks-content"
              sx={{
                minWidth: 48,
                minHeight: 48,
                '&:focus-visible': {
                  outline: `3px solid ${vendorConfig?.color || '#ff9800'}`,
                  outlineOffset: '2px'
                }
              }}
            >
              {expanded ? <KeyboardArrowUp aria-hidden="true" /> : <KeyboardArrowDown aria-hidden="true" />}
            </IconButton>
          </Box>
        </Box>

        {/* Progress bar */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary" id="progress-label">
              Fremdrift
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: vendorConfig?.color || '#ff9800' }}>
              {Math.round(progress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            aria-label={`Oppgavefremdrift: ${Math.round(progress)} prosent fullført`}
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-labelledby="progress-label"
            sx={{
              height: 10,
              borderRadius: 5,
              bgcolor: alpha(vendorConfig?.color || '#ff9800', 0.1),
              '& .MuiLinearProgress-bar': {
                bgcolor: vendorConfig?.color || '#ff9800',
                borderRadius: 5
              }
            }}
          />
        </Box>

        <Collapse in={expanded} id="tasks-content">
          {/* Celebration alert when all tasks complete */}
          <AnimatePresence>
            {allTasksComplete && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Alert
                  icon={<Celebration aria-hidden="true" />}
                  severity="success"
                  role="alert"
                  aria-live="polite"
                  sx={{ mb: 3, fontWeight: 600 }}
                >
                  🎉 Gratulerer! Du har fullført alle oppgaver. Butikken din er klar!
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active tasks */}
          {activeTasks.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                Aktive oppgaver ({activeTasks.length})
              </Typography>
              <List sx={{ mb: 2 }}>
                {activeTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <ListItem
                      disablePadding
                      sx={{
                        mb: 1,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2,
                        overflow: 'hidden',
                        borderLeft: `4px solid ${getPriorityColor(task.priority)}`
                      }}
                    >
                      <ListItemButton onClick={() => handleTaskClick(task)}>
                        <ListItemIcon>
                          <Checkbox
                            edge="start"
                            checked={task.completed}
                            onChange={() => handleToggleTask(task.id)}
                            icon={<RadioButtonUnchecked />}
                            checkedIcon={<CheckCircle sx={{ color: '#4caf50' }} />}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {task.title}
                              </Typography>
                              {task.estimatedTime && (
                                <Chip
                                  label={task.estimatedTime}
                                  size="small"
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                {task.description}
                              </Typography>
                              {task.currentProgress !== undefined && task.targetProgress && (
                                <LinearProgress
                                  variant="determinate"
                                  value={(task.currentProgress / task.targetProgress) * 100}
                                  sx={{ mt: 1, height: 4, borderRadius: 2 }}
                                />
                              )}
                              {task.benefits && task.benefits.length > 0 && (
                                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#4caf50' }}>
                                  ✓ {task.benefits[0]}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        {task.actionLabel && (
                          <Button
                            size="small"
                            variant="contained"
                            sx={{
                              mr: 1,
                              bgcolor: vendorConfig?.color || '#ff9800',
                              '&:hover': {
                                bgcolor: alpha(vendorConfig?.color || '#ff9800', 0.8)
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTaskClick(task);
                            }}
                          >
                            {task.actionLabel}
                          </Button>
                        )}
                      </ListItemButton>
                    </ListItem>
                  </motion.div>
                ))}
              </List>
            </>
          )}

          {/* Completed tasks (collapsible) */}
          {completedTasks.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, cursor: 'pointer' }}
                onClick={() => setShowCompleted(!showCompleted)}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle sx={{ fontSize: 18, color: '#4caf50' }} />
                  Fullførte oppgaver ({completedTasks.length})
                </Typography>
                <IconButton size="small">
                  {showCompleted ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                </IconButton>
              </Box>
              <Collapse in={showCompleted}>
                <List>
                  {completedTasks.map((task) => (
                    <ListItem key={task.id} sx={{ opacity: 0.6 }}>
                      <ListItemIcon>
                        <CheckCircle sx={{ color: '#4caf50' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={task.title}
                        secondary={task.description}
                        primaryTypographyProps={{ variant: 'body2', sx: { textDecoration: 'line-through' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
}


