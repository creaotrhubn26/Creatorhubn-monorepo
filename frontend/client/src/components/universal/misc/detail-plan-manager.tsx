import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  TextField, 
  Grid, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction, 
  IconButton, 
  Chip, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Alert, 
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Tooltip
} from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import { 
  Add, 
  Edit, 
  Delete, 
  CheckCircle, 
  Schedule, 
  ExpandMore,
  Assignment,
  Timeline,
  Person,
  LocationOn,
  CameraAlt,
  Videocam
} from '@mui/icons-material';

interface DetailPlanItem {
  id: string;
  title: string;
  description: string;
  category: 'preparation' | 'shooting' | 'post-production' | 'delivery' | 'meeting';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'planned' | 'in-progress' | 'completed' | 'on-hold';
  assignedTo?: string;
  dueDate?: string;
  estimatedHours: number;
  actualHours?: number;
  location?: string;
  equipment?: string[];
  notes?: string;
  worklogEntryId?: string; // Connection to UniversalWorklog
}

interface DetailPlanManagerProps {
  projectId: string;
  onWorklogCreate?: (worklogData: any) => void;
  onWorklogUpdate?: (worklogId: string, worklogData: any) => void
}

export default function DetailPlanManager({ 
  projectId, 
  onWorklogCreate, 
  onWorklogUpdate 
}: DetailPlanManagerProps) {
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  
  const [selectedItem, setSelectedItem] = useState<DetailPlanItem | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<DetailPlanItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch detail plan items
  const { data: planItems = [], isLoading } = useQuery({
    queryKey: ['/api/detail-plan', projectId],
    queryFn: () => {
      return apiRequest(`/api/detail-plan/${projectId}`, {
        headers: {
          "Content-Type": "application/json"
        }
      });
    },
    retry: false,
  });

  // Update plan item mutation
  const updatePlanItem = useMutation({
    mutationFn: async (data: DetailPlanItem) => {
      return apiRequest('/api/detail-plan/update', {
        headers: {
          "Content-Type": "application/json"
        },
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/detail-plan"] });
    }
  });

  // Create plan item mutation
  const createPlanItem = useMutation({
    mutationFn: async (data: Omit<DetailPlanItem, 'id'>) => {
      return apiRequest('/api/detail-plan/create', {
        headers: {
          "Content-Type": "application/json"
        },
        method: 'POST',
        body: JSON.stringify({ ...data, projectId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/detail-plan"] });
      setShowDialog(false);
      setEditingItem(null);
    }
  });

  // Delete plan item mutation
  const deletePlanItem = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest(`/api/detail-plan/${itemId}`, {
        headers: {
          "Content-Type": "application/json"
        },
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/detail-plan"] });
    }
  });

  // Create worklog entry from plan item
  const createWorklogFromPlan = useCallback(async (item: DetailPlanItem) => {
    const worklogData = {
      projectId,
      userId: user?.id || user?.email || 'unknown-user',
      day: 1, // Default to day 1, can be adjusted
      title: item.title,
      description: item.description,
      timeSpent: item.actualHours || item.estimatedHours,
      category: item.category,
      mood: 'focused',
      nextSteps: `Complete ${item.title}`,
      isPrivate: false,
      // Additional context
      planItemId: item.id,
      priority: item.priority,
      status: item.status,
      location: item.location,
      equipment: item.equipment?.join(', '),
      notes: item.notes
};

    try {
      const response = await apiRequest('/api/worklog/create', {
        headers: {
          "Content-Type": "application/json"
        },
        method: 'POST',
        body: JSON.stringify(worklogData)
      });

      if (response) {
        // Update plan item with worklog entry ID
        updatePlanItem.mutate({
          ...item,
          worklogEntryId: response.id
    });
        
        onWorklogCreate?.(response);
    }
  } catch (error) {
      console.error('Failed to create worklog entry: ', error);
  }
}, [projectId, user, updatePlanItem, onWorklogCreate]);

  // Filter plan items
  const filteredItems = planItems.filter((item: DetailPlanItem) => {
    const categoryMatch = filterCategory === 'all' || item.category === filterCategory;
    const statusMatch = filterStatus === 'all' || item.status === filterStatus;
    return categoryMatch && statusMatch;
});

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'preparation': return <Assignment />;
      case 'shooting': return <CameraAlt />;
      case 'post-production': return <Videocam />;
      case 'delivery': return <CheckCircle />;
      case 'meeting': return <Person />;
      default: return <Timeline />;
  }
};

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'default';
      default: return 'default';
}
};

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in-progress': return 'warning';
      case 'on-hold': return 'error';
      case 'planned': return 'default';
      default: return 'default';
}
};

  // Group items by category
  const groupedItems = filteredItems.reduce((acc: any, item: DetailPlanItem) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
}
    acc[item.category].push(item);
    return acc;
}, {});

  return (
    <Box sx={{ p:  2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h4" component="h1" sx={{ color: theming.colors.primary }}>
          Detail Plan Manager
        </Typography>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={() => setShowDialog(true)}
        >
          Add Plan Item
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  <MenuItem value="preparation">Preparation</MenuItem>
                  <MenuItem value="shooting">Shooting</MenuItem>
                  <MenuItem value="post-production">Post-Production</MenuItem>
                  <MenuItem value="delivery">Delivery</MenuItem>
                  <MenuItem value="meeting">Meeting</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="planned">Planned</MenuItem>
                  <MenuItem value="in-progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="on-hold">On Hold</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="textSecondary">
                {filteredItems.length} items found
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Plan Items by Category */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
          <CircularProgress />
        </Box>
      ) : Object.keys(groupedItems).length === 0 ? (
        <Alert severity="info">
          No plan items found. Create your first plan item to get started.
        </Alert>
      ) : (
        Object.entries(groupedItems).map(([category, items]: [string, any]) => (
          <Accordion key={category} defaultExpanded>
            <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                {getCategoryIcon(category)}
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ', ')}
                </Typography>
                <Chip 
                  label={`${items.length} items`} 
                  size="small" 
                  color="primary" 
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                {items.map((item: DetailPlanItem, index: number) => (
                  <React.Fragment key={item.id}>
                    <ListItem
                      sx={{
                        bgcolor: 'background.paper',
                        borderRadius:  1,
                        mb: 1, '&:hover': { bgcolor: 'action.hover',}
                    }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>{item.title}</Typography>
                            <Chip 
                              label={item.priority} 
                              color={getPriorityColor(item.priority) as any}
                              size="small"
                            />
                            <Chip 
                              label={item.status} 
                              color={getStatusColor(item.status) as any}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                      }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="textSecondary" sx={{ mb:  1 }}>
                              {item.description}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                              <Chip 
                                icon={theming.getThemedIcon('schedule')} 
                                label={`${item.estimatedHours}h`} 
                                size="small" 
                                variant="outlined"
                              />
                              {item.location && (
                                <Chip 
                                  icon={theming.getThemedIcon('location')} 
                                  label={item.location} 
                                  size="small" 
                                  variant="outlined"
                                />
                              )}
                              {item.assignedTo && (
                                <Chip 
                                  icon={theming.getThemedIcon('person')} 
                                  label={item.assignedTo} 
                                  size="small" 
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </Box>
                      }
                      />
                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', gap:  1 }}>
                          {!item.worklogEntryId && (
                            <Tooltip title="Create Worklog Entry">
                              <IconButton
                                onClick={() => createWorklogFromPlan(item)}
                                color="primary"
                                size="small"
                              >
                                {theming.getThemedIcon('timeline')}
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Edit">
                            <IconButton
                              onClick={() => {
                                setEditingItem(item);
                                setShowDialog(true);
                            }}
                              size="small"
                            >
                              {theming.getThemedIcon('edit')}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              onClick={() => deletePlanItem.mutate(item.id)}
                              color="error"
                              size="small"
                            >
                              {theming.getThemedIcon('delete')}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < items.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        ))
      )}

      {/* Plan Item Dialog */}
      <Dialog 
        open={showDialog} 
        onClose={() => {
          setShowDialog(false);
          setEditingItem(null);
      }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingItem ? 'Edit Plan Item' : 'Add Plan Item'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                defaultValue={editingItem?.title || ', '}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                defaultValue={editingItem?.description || ', '}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select defaultValue={editingItem?.category || 'preparation'}>
                  <MenuItem value="preparation">Preparation</MenuItem>
                  <MenuItem value="shooting">Shooting</MenuItem>
                  <MenuItem value="post-production">Post-Production</MenuItem>
                  <MenuItem value="delivery">Delivery</MenuItem>
                  <MenuItem value="meeting">Meeting</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select defaultValue={editingItem?.priority || 'medium'}>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Estimated Hours"
                type="number"
                defaultValue={editingItem?.estimatedHours || 0}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Location"
                defaultValue={editingItem?.location || ', '}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Equipment Needed"
                defaultValue={editingItem?.equipment?.join('') || ','}
                helperText="Separate multiple items with commas"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={2}
                defaultValue={editingItem?.notes || ''}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained" 
            onClick={() => {
              // Handle plan item creation/update
              setShowDialog(false);
              setEditingItem(null);
          }}
          >
            {editingItem ? 'Update Item' : 'Create Item'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
