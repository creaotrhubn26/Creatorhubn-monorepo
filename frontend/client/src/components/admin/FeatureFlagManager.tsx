import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
} from '@mui/material';
import {
  Settings,
  Edit,
  Save,
  Cancel,
  Add,
  Delete,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { AdminButton, StatusChip, AdminLoading, AdminError } from './design-system';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  category: string;
  isEnabled: boolean;
  usageCount: number;
  lastModified: string;
}

const FeatureFlagManager: React.FC = () => {
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    name: ',',
    description: '',
    category: '',
});

  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');

  // Fetch all feature flags
  const { data: featureFlags = [], isLoading, error } = useQuery({
    queryKey: ['/api/admin/features'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/features', { headers });
    },
    select: (d) => (Array.isArray(d) ? d : []),
    refetchInterval: 30000, // Refresh every 30 seconds
});

  // Toggle feature flag mutation
  const toggleFlagMutation = useMutation({
    mutationFn: async ({ flagId, isEnabled }: { flagId: string; isEnabled: boolean }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/features/${flagId}`, {
        method: 'PATCH',
        headers: {
          ...headers, 'Content-Type' : 'application/json'
        },
        body: JSON.stringify({ isEnabled }),
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/features'] });
  },
});

  // Update feature flag mutation
  const updateFlagMutation = useMutation({
    mutationFn: async (updatedFlag: Partial<FeatureFlag>) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/features/${updatedFlag.id}`, {
        method: 'PATCH',
        headers: {
          ...headers, 'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedFlag),
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/features'] });
      setShowEditDialog(false);
      setEditingFlag(null);
  },
});

  const handleToggleFlag = (flagId: string, currentStatus: boolean) => {
    toggleFlagMutation.mutate({ flagId, isEnabled: !currentStatus });
};

  const handleEditFlag = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setEditForm({
      name: flag.name,
      description: flag.description,
      category: flag.category,
  });
    setShowEditDialog(true);
};

  const handleSaveEdit = () => {
    if (editingFlag) {
      updateFlagMutation.mutate({
        id: editingFlag.id,
        ...editForm,
    });
  }
};

  const handleCancelEdit = () => {
    setShowEditDialog(false);
    setEditingFlag(null);
    setEditForm({ name: ', ', description: ', ', category: ',' });
};

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'ai-features':'#e3f2fd','video-editing':'#f3e5f5','automation':'#e8f5e8','premium':'#fff3e0','beta':'#fce4ec','default' : '#f5f5f5',
  };
    return colors[category] || colors.default;
};

  const getCategoryTextColor = (category: string) => {
    const colors: Record<string, string> = {
      'ai-features':'#1976d2','video-editing':'#7b1fa2','automation':'#388e3c','premium':'#f57c00','beta':'#c2185b','default' : '#424242',
  };
    return colors[category] || colors.default;
};

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <AdminLoading label="Loading feature flags..." />
      </Box>
    );
}

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <AdminError message="Failed to load feature flags. Please try again." />
      </Box>
    );
}

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h2" gutterBottom sx={{ color: theming.colors.primary }}>
        Feature Flag Manager
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Manage feature flags to control access to different parts of the application.
      </Typography>

      <Grid container spacing={3}>
        {featureFlags.map((flag: FeatureFlag) => (
          <Grid item xs={12} md={6} lg={4} key={flag.id}>
            <Card 
              sx={{ 
                height: '100%',
                border: flag.isEnabled ? '2px solid #4caf50' : '1px solid #e0e0e0',
                transition: 'all 0.3s ease', '&:hover': {
                  boxShadow: 3,
              }
            }}
            >
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" component="h3" sx={{ color: theming.colors.primary }}>
                    {flag.name}
                  </Typography>
                  <StatusChip
                    tone={flag.isEnabled ? 'success' : 'neutral'}
                    label={flag.isEnabled ? 'Enabled' : 'Disabled'}
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {flag.description}
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Chip
                    label={flag.category}
                    size="small"
                    sx={{
                      bgcolor: getCategoryColor(flag.category),
                      color: getCategoryTextColor(flag.category)}}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Used {flag.usageCount} times
                  </Typography>
                </Box>

                <Typography variant="caption" color="text.secondary" display="block">
                  Last modified: {new Date(flag.lastModified).toLocaleDateString()}
                </Typography>
              </CardContent>

              <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={flag.isEnabled}
                      onChange={() => handleToggleFlag(flag.id, flag.isEnabled)}
                      disabled={toggleFlagMutation.isPending}
                    />
                }
                  label={flag.isEnabled ? 'Disable' : 'Enable'}
                />
                <Button
                  size="small"
                  startIcon={<Edit />}
                  onClick={() => handleEditFlag(flag)}
                >
                  Edit
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onClose={handleCancelEdit} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Feature Flag</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            variant="outlined"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Category"
            fullWidth
            variant="outlined"
            value={editForm.category}
            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
            helperText="Categories: ai-features, video-editing, automation, premium, beta"
          />
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={handleCancelEdit} startIcon={<Cancel />}>
            Cancel
          </AdminButton>
          <AdminButton
            tone="primary"
            onClick={handleSaveEdit}
            startIcon={<Save />}
            loading={updateFlagMutation.isPending}
          >
            Save Changes
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FeatureFlagManager;
















