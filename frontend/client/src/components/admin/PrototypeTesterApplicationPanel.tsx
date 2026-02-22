import { useTheming } from '../../utils/theming-helper';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Badge,
  Paper,
  InputAdornment,
  Autocomplete,
  Tooltip as MuiTooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Person,
  Email,
  Business,
  OpenInNew,
  Search,
  FilterList,
  GetApp,
  Clear,
  Schedule,
  Assignment,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import 'quill/dist/quill.snow.css';

interface PrototypeTesterApplication {
  id: string;
  name: string;
  email: string;
  company?: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'other' | 'enterprise';
  testingAreas: string[];
  experience: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  feedback: string;
  availableTime?: string;
  deviceInfo?: string;
  hasAgreedToTerms: boolean;
  detailedFeedback?: string;
  testingNotes?: string;
  expectations?: string;
  locationContext?: {
    profession: string;
    dashboardType: string;
    currentTab: string;
    currentSection: string;
    specificFeature?: string;
    pageUrl: string;
    userAgent: string;
    timestamp: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'inactive';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

type FilterStatus = 'pending' | 'approved' | 'rejected' | 'inactive';

export default function PrototypeTesterApplicationPanel() {
  const [selectedApplication, setSelectedApplication] = useState<PrototypeTesterApplication | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus[]>([]);
  const [filterProfession, setFilterProfession] = useState<string[]>([]);
  
  const queryClient = useQueryClient();
  const theming = useTheming('prototype_tester,');
  const { analytics, performance, debugging, lifecycle, auth } = useEnhancedMasterIntegration();
  const user = auth.user;

  // Component registration
  useEffect(() => {
    const endTiming = performance.startTiming('prototype_application_panel_init, ');
    
    lifecycle.registerComponent({
      id: 'prototype-application-panel',
      type: 'admin-panel',
      version: '1.0.0',
      capabilities: {
        data: ['applications:read','applications:approve','applications:reject'],
        events: ['application:approved','application:rejected'],
        actions: ['filter','search','approve','reject','export'],
        ui: ['search','filter-controls'],
        system: ['real-time-updates']
      },
      dependencies: ['query-client','theming-system','auth-system'],
      lastActive: Date.now(),
      performance: { renderCount: 0, avgRenderTime: 0, memoryUsage: 0 }
    });

    analytics.trackEvent('prototype_application_panel_mounted', {
      timestamp: Date.now()
    });

    return () => {
      endTiming();
      lifecycle.unregisterComponent('prototype-application-panel');
    };
  }, []);

  // Fetch all prototype tester applications
  const { data: applications = [], isLoading } = useQuery<PrototypeTesterApplication[]>({
    queryKey: ['/api/invites/prototype-tester-applications'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/invites/prototype-tester-applications', { headers });
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Approve application mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/invites/prototype-tester/${id}/approve`, {
        method: 'POST',
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invites/prototype-tester-applications'] });
      setActionDialogOpen(false);
      setSelectedApplication(null);

      analytics.trackEvent('application_approved', {
        applicationId: selectedApplication?.id,
        profession: selectedApplication?.profession,
        timestamp: Date.now()
      });
    }
  });

  // Reject application mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/invites/prototype-tester/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
        headers: {
          ...headers, , 'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invites/prototype-tester-applications'] });
      setActionDialogOpen(false);
      setSelectedApplication(null);
      setRejectionReason('');
      
      analytics.trackEvent('application_rejected', {
        applicationId: selectedApplication?.id,
        profession: selectedApplication?.profession,
        timestamp: Date.now()
      });
    }
  });

  const handleApprove = useCallback((application: PrototypeTesterApplication) => {
    setSelectedApplication(application);
    setActionType('approve');
    setActionDialogOpen(true);
  }, []);

  const handleReject = useCallback((application: PrototypeTesterApplication) => {
    setSelectedApplication(application);
    setActionType('reject');
    setActionDialogOpen(true);
  }, []);

  const handleConfirmAction = useCallback(() => {
    if (!selectedApplication) return;
    
    if (actionType === 'approve') {
      approveMutation.mutate(selectedApplication.id);
    } else {
      rejectMutation.mutate({ id: selectedApplication.id, reason: rejectionReason });
    }
  }, [selectedApplication, actionType, rejectionReason, approveMutation, rejectMutation]);

  // Profession branding
  const professionConfig = theming.professionConfig;

  // Get unique professions
  const availableProfessions = useMemo(() => {
    const professions = new Set(applications.map(a => a.profession);
)    return Array.from(professions).sort();
  }, [applications]);

  // Filtered applications
  const filteredApplications = useMemo(() => {
    let filtered = [...applications];
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(search) ||
        a.email.toLowerCase().includes(search) ||
        a.company?.toLowerCase().includes(search);
    }
    
    // Status filter
    if (filterStatus.length > 0) {
      filtered = filtered.filter(a => filterStatus.includes(a.status);
    }
    
    // Profession filter
    if (filterProfession.length > 0) {
      filtered = filtered.filter(a => filterProfession.includes(a.profession);
    }
    
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }, [applications, searchTerm, filterStatus, filterProfession]);

  // Statistics
  const stats = useMemo(() => ({
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    inactive: applications.filter(a => a.status === 'inactive').length
  }), [applications]);

  // Export to CSV
  const exportToCSV = useCallback(() => {
    const headers = ['Date','Name','Email','Company','Profession','Experience','Status','Testing Areas'];
    const rows = filteredApplications.map(a => [
      new Date(a.createdAt).toLocaleString('no-NO'),
      a.name,
      a.email,
      a.company || '',
      a.profession,
      a.experience,
      a.status,
      a.testingAreas.join(';')
    ]);
    
    const csvContent = [
      headers.join(''),
      ...rows.map(row => row.map(cell => `"${cell},"`).join('')
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `prototype-tester-applications-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    analytics.trackEvent('applications_exported', {
      format: 'csv',
      rowCount: filteredApplications.length,
      timestamp: Date.now()
    });
  }, [filteredApplications, analytics]);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterStatus([]);
    setFilterProfession([]);
  }, []);

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
          🧪 Prototype Tester Applications
        </Typography>
        <Alert severity="info">Loading applications...</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ color: '#ff8c00', fontWeight: 'bold' }}>
        🧪 Prototype Tester Applications
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage and review incoming prototype tester applications. Approve or reject applications to control platform access.
      </Typography>

      {/* Search and Filter Controls */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
        <Grid container spacing={2} alignItems="center">
          {/* Search */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: '#ff8c00' }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm(', ')}>
                      <Clear />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>

          {/* Status Filter */}
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              multiple
              size="small"
              options={['pending', 'approved', 'rejected','inactive'] as FilterStatus[]}
              value={filterStatus}
              onChange={(_, newValue) => setFilterStatus(newValue)}
              renderInput={(params) => (
                <TextField {...params} label="Status" placeholder="Filter status" />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip {...getTagProps({ index })} key={option} label={option} size="small" />
                ))
              }
            />
          </Grid>

          {/* Profession Filter */}
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              multiple
              size="small"
              options={availableProfessions}
              value={filterProfession}
              onChange={(_, newValue) => setFilterProfession(newValue)}
              renderInput={(params) => (
                <TextField {...params} label="Profession" placeholder="Filter profession" />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}, sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {professionConfig[option]?.emoji || '🔧'} {professionConfig[option]?.label || option}
                </Box>
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip 
                    {...getTagProps({ index })} 
                    key={option} 
                    label={`${professionConfig[option]?.emoji || '🔧'} ${professionConfig[option]?.label || option}`} 
                    size="small"
                    sx={{ bgcolor: professionConfig[option]?.color, color: 'white' }} />
                ))
              }
            />
          </Grid>

          {/* Actions */}
          <Grid item xs={12} md={2}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <MuiTooltip title="Export to CSV">
                <IconButton 
                  onClick={exportToCSV}
                  sx={{ 
                    border: '1px solid',
                    borderColor: 'divider',
                    color: '#4caf50'
                  }}>
                  <GetApp />
                </IconButton>
              </MuiTooltip>
              {(searchTerm || filterStatus.length > 0 || filterProfession.length > 0) && (
                <MuiTooltip title="Clear filters">
                  <IconButton 
                    onClick={clearFilters}
                    sx={{ 
                      border: '1px solid',
                      borderColor: 'divider',
                      color: '#f44336'
                    }}>
                    <Clear />
                  </IconButton>
                </MuiTooltip>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* Active Filters Display */}
        {(searchTerm || filterStatus.length > 0 || filterProfession.length > 0) && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Active filters: </Typography>
            {searchTerm && (
              <Chip 
                label={`Search: "${searchTerm}"`} 
                size="small" 
                onDelete={() => setSearchTerm(', ')}
                sx={{ bgcolor: '#ff8c00', color: 'white' }} />
            )}
            {filterStatus.map(status => (
              <Chip 
                key={status} 
                label={`Status: ${status}`} 
                size="small" 
                onDelete={() => setFilterStatus(filterStatus.filter(s => s !== status)}
              />
            ))}
            {filterProfession.map(profession => (
              <Chip 
                key={profession} 
                label={`${professionConfig[profession]?.emoji || '🔧'} ${professionConfig[profession]?.label || profession}`} 
                size="small" 
                onDelete={() => setFilterProfession(filterProfession.filter(p => p !== profession))}
                sx={{ bgcolor: professionConfig[profession]?.color, color: 'white' }} />
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              Showing {filteredApplications.length} of {applications.length}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={2}, sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #2196F3 0%, #21CBF3 100%)' }}>
            <CardContent sx={{ color: 'white', textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {stats.total}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Total Applications
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #FF9800 0%, #FFB74D 100%)' }}>
            <CardContent sx={{ color: 'white', textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {stats.pending}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                ⏳ Pending Review
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)' }}>
            <CardContent sx={{ color: 'white', textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {stats.approved}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                ✅ Approved
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #F44336 0%, #EF5350 100%)' }}>
            <CardContent sx={{ color: 'white', textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {stats.rejected}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                ❌ Rejected
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #9C27B0 0%, #BA68C8 100%)' }}>
            <CardContent sx={{ color: 'white', textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {stats.inactive}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                ⚪ Inactive
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Applications List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            <Assignment sx={{ mr: 1 }} />
            Applications
            <Badge badgeContent={stats.pending} color="warning" sx={{ ml: 1 }} />
          </Typography>

          {applications.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No applications received yet.
            </Alert>
          ) : filteredApplications.length === 0 ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              No applications match the selected filters.
            </Alert>
          ) : (
            <List>
              {filteredApplications.map((application, index) => {
                const config = professionConfig[application.profession] || professionConfig.other;
                const statusColor = application.status === 'approved' ? '#4caf50' : application.status === 'rejected' ? '#f44336' : application.status === 'pending' ? '#ff9800' : '#757575';
                
                return (
                  <React.Fragment key={application.id}>
                    <ListItem
                      sx={{
                        bgcolor: application.status === 'pending' ? 'rgba(255, 152, 0, 0.05)' : 'transparent',
                        borderRadius: 1,
                        mb: 1,
                        borderLeft: `4px solid ${config.color}`
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Person sx={{ color: '#ff8c00', fontSize: 20 }} />
                              <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                                {application.name}
                              </Typography>
                              <Chip
                                label={`${config.emoji} ${config.label}`}
                                size="small"
                                sx={{
                                  bgcolor: config.color,
                                  color: 'white',
                                  fontWeight: 'bold'
                                }} />
                              <Chip
                                label={application.status}
                                size="small"
                                sx={{
                                  bgcolor: statusColor,
                                  color: 'white',
                                  fontWeight: 'bold'
                                }} />
                              <Chip
                                label={application.experience}
                                size="small"
                                variant="outlined"
                              />
                            </Box>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Email sx={{ fontSize: 16 }} /> {application.email}
                              {application.company && (
                                <>
                                  <Business sx={{ fontSize: 16, ml: 1 }} /> {application.company}
                                </>
                              )}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Testing: {application.testingAreas.slice(0, 3).join(', ')}
                              {application.testingAreas.length > 3 && ` +${application.testingAreas.length - 3} more`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              <Schedule sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                              Applied: {new Date(application.createdAt).toLocaleString('no-NO')}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton 
                            onClick={() => {
                              setSelectedApplication(application);
                              setDetailDialogOpen(true);
                            }}
                            sx={{ bgcolor: 'primary.main', color: 'white','&:hover': { bgcolor: 'primary.dark' } }}

                          >
                            <OpenInNew />
                          </IconButton>
                          {application.status === 'pending' && (
                            <>
                              <IconButton
                                onClick={() => handleApprove(application)}
                                sx={{ color: '#4caf50','&:hover': { bgcolor: 'rgba(7, 6, 1, 758, 0, 0.1)' } }}

                              >
                                <CheckCircle />
                              </IconButton>
                              <IconButton
                                onClick={() => handleReject(application)}
                                sx={{ color: '#f44336', '&:hover': { bgcolor: 'rgba(2, 4, 4, 675, 4, 0.1)' } }}

                              >
                                <Cancel />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < filteredApplications.length - 1 && <Divider sx={{ my: 1 }} />}
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
          Application Details
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedApplication && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h6">{selectedApplication.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{selectedApplication.email}</Typography>
                  {selectedApplication.company && (
                    <Typography variant="body2" color="text.secondary">{selectedApplication.company}</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Profession</Typography>
                  <Typography>{selectedApplication.profession}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Experience</Typography>
                  <Typography>{selectedApplication.experience}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Testing Areas</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                    {selectedApplication.testingAreas.map(area => (
                      <Chip key={area} label={area} size="small" />
                    ))}
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Feedback</Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2">{selectedApplication.feedback}</Typography>
                  </Paper>
                </Grid>
                {selectedApplication.detailedFeedback && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Detailed Feedback</Typography>
                    <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <div dangerouslySetInnerHTML={{ __html: selectedApplication.detailedFeedback }} />
                    </Paper>
                  </Grid>
                )}
                {selectedApplication.testingNotes && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Testing Notes</Typography>
                    <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <div dangerouslySetInnerHTML={{ __html: selectedApplication.testingNotes }} />
                    </Paper>
                  </Grid>
                )}
                {selectedApplication.expectations && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Expectations</Typography>
                    <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <div dangerouslySetInnerHTML={{ __html: selectedApplication.expectations }} />
                    </Paper>
                  </Grid>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
          {selectedApplication?.status === 'pending' && (
            <>
              <Button 
                variant="contained" 
                color="success"
                onClick={() => {
                  setDetailDialogOpen(false);
                  handleApprove(selectedApplication);
                }}
              >
                Approve
              </Button>
              <Button 
                variant="contained" 
                color="error"
                onClick={() => {
                  setDetailDialogOpen(false);
                  handleReject(selectedApplication);
                }}
              >
                Reject
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog
        open={actionDialogOpen}
        onClose={() => setActionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {actionType === 'approve' ? 'Approve Application' : 'Reject Application'}
        </DialogTitle>
        <DialogContent>
          {selectedApplication && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" gutterBottom>
                {actionType === 'approve' 
                  ? `Are you sure you want to approve ${selectedApplication.name}'s application?`
                  : `Are you sure you want to reject ${selectedApplication.name}'s application?`
                }
              </Typography>
              
              {actionType === 'reject' && (
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Rejection Reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide a reason for rejection..."
                  sx={{ mt: 2 }} />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained"
            color={actionType === 'approve' ? 'success' : 'error'}
            onClick={handleConfirmAction}
            disabled={actionType === 'reject' && !rejectionReason}
          >
            {actionType === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
