import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Divider,
  Avatar,
  Tooltip,
  ButtonGroup,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  TrendingUp as TimelineIcon,
  Edit,
  Comment,
  Person,
  PhotoCamera,
  Schedule,
  Visibility,
  Add,
  ExpandMore,
  FilterList,
  Refresh,
  TrendingUp,
  Group,
  Message,
  Notifications,
  CalendarToday,
  CheckCircle,
  Cancel,
  SelectAll,
  History,
  AccessTime
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface TimelineChange {
  id: string;
  timelineId: string;
  changeType: 'photographer_update' | 'client_comment' | 'status_change';
  changeDescription: string;
  changeDetails: any;
  changedBy: 'photographer' | 'client';
  changedByName: string;
  changedByEmail: string;
  timelineItemId?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
  coupleName?: string;
  projectName?: string;
  weddingDate?: string
}

interface ChangesOverviewData {
  totalChanges: number;
  recentChanges: TimelineChange[];
  changesByType: Record<string, number>;
  changesByTimeline: Record<string, {
    timelineId: string;
    coupleName: string;
    projectName: string;
    weddingDate: string;
    changes: TimelineChange[];
}>;
}

interface WeddingTimelineChangesOverviewProps {
  userId: string
}

export default function WeddingTimelineChangesOverview({ userId }: WeddingTimelineChangesOverviewProps) {
  const [filterType, setFilterType] = useState<string>('client_comment'); // Start with client comments
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedChange, setSelectedChange] = useState<TimelineChange | null>(null);
  const [showOnlyNewChanges, setShowOnlyNewChanges] = useState(false);
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const queryClient = useQueryClient();
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');

  // Fetch changes overview
  const { data: changesData, isLoading, refetch } = useQuery<ChangesOverviewData>({
    queryKey: ['/api/wedding-timeline/changes-overview', userId],
    queryFn: () => apiRequest(`/api/wedding-timeline/changes-overview/${userId}`),
    refetchInterval: 30000 // Refresh every 30 seconds
});

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case 'photographer_update':
        return <Edit sx={{ color: '#E91E63'}} />;
      case 'client_comment':
        return <Comment sx={{ color: '#2196F3'}} />;
      case 'status_change':
        return <Schedule sx={{ color: '#4CAF50'}} />;
      default: return <TimelineIcon sx={{ color: '#9E9E9E'}} />;
  }
};

  const getChangeTypeLabel = (changeType: string) => {
    switch (changeType) {
      case 'photographer_update':
        return 'Fotograf Oppdatering';
      case 'client_comment':
        return 'Klient Kommentar';
      case 'status_change':
        return 'Status Endring';
      default:
        return changeType;
}
};

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'photographer_update':
        return '#E91E63';
      case 'client_comment':
        return '#2196F3';
      case 'status_change':
        return '#4CAF50';
      default:
        return '#9E9E9E';
}
};

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('no-N', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
});
};

  const filteredChanges = (changesData?.recentChanges || []).filter(change => {
    // Primary filter by type
    const typeMatch = filterType === 'all' || change.changeType === filterType;
    
    // Secondary filter for new changes (last 24 hours)
    const isNew = showOnlyNewChanges ? 
      new Date(change.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000) : true;
    
    return typeMatch && isNew;
}) || [];

  // Separate client changes for highlighted display
  const clientChanges = filteredChanges.filter(change => change.changedBy === 'client');
  const photographerChanges = filteredChanges.filter(change => change.changedBy === 'photographer');

  const getActivitySummary = () => {
    if (!changesData) return { total: 0, client: 0, photographer:  0 };
    
    const total = changesData.totalChanges;
    const recentChanges = changesData.recentChanges || [];
    const client = recentChanges.filter(c => c.changedBy === 'client').length;
    const photographer = recentChanges.filter(c => c.changedBy === 'photographer').length;
    
    return { total, client, photographer };
};

  const activitySummary = getActivitySummary();

  return (
    <Box sx={{ p: 3, bgcolor: '#F5F7FA', minHeight: '100vh' }}>
      {/* Modern Header Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 3,
          p: 4,
          mb: 3,
          color: 'white',
          boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 3 }}>
          <Box sx={{ flex: 1, minWidth: 300 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                <Comment sx={{ fontSize: '2rem', color: 'white' }} />
              </Avatar>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Klientendringer
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Bryllupstidslinjer
                </Typography>
              </Box>
            </Box>
            <Typography variant="body1" sx={{ opacity: 0.85, maxWidth: 600 }}>
              Administrer alle kommentarer og ønsker fra dine bryllupspar på ett sted
            </Typography>
          </Box>
          
          {/* Quick Stats */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Tooltip title="Totale endringer">
              <Paper sx={{ 
                px: 3, 
                py: 2, 
                bgcolor: 'rgba(255,255,255,0.15)', 
                backdropFilter: 'blur(10px)',
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.2)',
                minWidth: 100,
                textAlign: 'center'
              }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                  {activitySummary.total}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  Totalt
                </Typography>
              </Paper>
            </Tooltip>
            <Tooltip title="Nye klientkommentarer">
              <Paper sx={{ 
                px: 3, 
                py: 2, 
                bgcolor: 'rgba(33, 150, 243, 0.9)',
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.2)',
                minWidth: 100,
                textAlign: 'center',
                position: 'relative',
                overflow: 'visible'
              }}>
                {activitySummary.client > 0 && (
                  <Badge 
                    badgeContent="Ny!" 
                    sx={{ 
                      position: 'absolute', 
                      top: -8, 
                      right: -8,
                      '& .MuiBadge-badge': {
                        bgcolor: '#FF5252',
                        color: 'white',
                        fontWeight: 700
                      }
                    }} 
                  />
                )}
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                  {activitySummary.client}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  Klienter
                </Typography>
              </Paper>
            </Tooltip>
            <Tooltip title="Dine oppdateringer">
              <Paper sx={{ 
                px: 3, 
                py: 2, 
                bgcolor: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.2)',
                minWidth: 100,
                textAlign: 'center'
              }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                  {activitySummary.photographer}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  Fotograf
                </Typography>
              </Paper>
            </Tooltip>
          </Box>
        </Box>
        
        {/* Alert for pending actions */}
        {clientChanges.length > 0 && (
          <Alert
            severity="warning"
            icon={<Notifications />}
            sx={{
              mt: 3,
              bgcolor: 'rgba(255,152,0,0.15)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,152,0,0.3)',
              color: 'white',
              '& .MuiAlert-icon': { color: '#FFB74D' },
              borderRadius: 2
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              ⚡ {clientChanges.length} nye klientkommentarer venter på gjennomgang
            </Typography>
          </Alert>
        )}
      </Box>

      {/* Floating Action Toolbar */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 2.5,
          bgcolor: 'white',
          borderRadius: 3,
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showHistory}
                  onChange={(e) => setShowHistory(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#667eea',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      bgcolor: '#667eea',
                    },
                  }}
                />
              }
              label={<Typography variant="body2" fontWeight={500}>Vis historikk</Typography>}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button
              fullWidth
              variant={showOnlyNewChanges ? 'contained' : 'outlined'}
              onClick={() => setShowOnlyNewChanges(!showOnlyNewChanges)}
              startIcon={<AccessTime />}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                bgcolor: showOnlyNewChanges ? '#FF9800' : 'transparent',
                borderColor: '#FF9800',
                color: showOnlyNewChanges ? 'white' : '#FF9800',
                '&:hover': {
                  bgcolor: showOnlyNewChanges ? '#F57C00' : 'rgba(255, 152, 0, 0.08)',
                  borderColor: '#F57C00'
                }
              }}
            >
              Kun nye (24t)
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => refetch()}
              startIcon={<Refresh />}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                borderColor: '#667eea',
                color: '#667eea',
                '&:hover': {
                  borderColor: '#5568d3',
                  bgcolor: 'rgba(102, 126, 234, 0.08)'
                }
              }}
            >
              Oppdater
            </Button>
          </Grid>
          {selectedChanges.size > 0 && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  onClick={async () => {
                    for (const changeId of selectedChanges) {
                      try {
                        await apiRequest(`/api/wedding-timeline/changes/${changeId}/approve`, {
                          method: 'PUT',
                        });
                      } catch (error) {
                        console.error('Failed to approve change: ', error);
                      }
                    }
                    setSelectedChanges(new Set());
                    refetch();
                  }}
                  sx={{ flex: 1, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                >
                  ✓ {selectedChanges.size}
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  onClick={async () => {
                    for (const changeId of selectedChanges) {
                      try {
                        await apiRequest(`/api/wedding-timeline/changes/${changeId}/reject`, {
                          method: 'PUT',
                        });
                      } catch (error) {
                        console.error('Failed to reject change:', error);
                      }
                    }
                    setSelectedChanges(new Set());
                    refetch();
                  }}
                  sx={{ flex: 1, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                >
                  ✕ {selectedChanges.size}
                </Button>
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>
      {/* Modern Filter Section */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 3,
          bgcolor: 'white',
          borderRadius: 3,
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
        }}
      >
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterList sx={{ color: '#667eea' }} />
            Filtrer endringer
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Velg hvilke endringer du vil se i listen under.
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {[
            { 
              key: 'client_comment', 
              label: `Klientkommentarer`, 
              count: clientChanges.length,
              icon: Comment, 
              color: '#2196F3',
              gradient: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
              priority: true 
            },
            { 
              key: 'photographer_update', 
              label: `Dine oppdateringer`, 
              count: photographerChanges.length,
              icon: Edit,
              color: '#E91E63',
              gradient: 'linear-gradient(135deg, #E91E63 0%, #C2185B 100%)'
            },
            { 
              key: 'all', 
              label: 'Alle endringer', 
              count: filteredChanges.length,
              icon: TimelineIcon,
              color: '#667eea',
              gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            },
            { 
              key: 'status_change', 
              label: 'Statusendringer', 
              count: 0,
              icon: Schedule,
              color: '#4CAF50',
              gradient: 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)'
            }
          ].map(({ key, label, count, icon: Icon, color, gradient, priority }) => (
            <Button
              key={key}
              variant={filterType === key ? 'contained' : 'outlined'}
              onClick={() => setFilterType(key)}
              startIcon={<Icon />}
              endIcon={
                <Chip
                  label={count}
                  size="small"
                  sx={{
                    height: 20,
                    minWidth: 28,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    bgcolor: filterType === key ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                    color: filterType === key ? 'white' : color,
                    '& .MuiChip-label': { px: 1 }
                  }}
                />
              }
              sx={{
                borderRadius: 25,
                px: 3,
                py: 1.5,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: priority ? '1rem' : '0.875rem',
                border: filterType === key ? 'none' : `2px solid ${color}`,
                background: filterType === key ? gradient : 'transparent',
                color: filterType === key ? 'white' : color,
                boxShadow: filterType === key ? `0 4px 15px ${color}40` : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 6px 20px ${color}50`,
                  background: filterType === key ? gradient : `${color}08`,
                  borderColor: color
                }
              }}
            >
              {label}
            </Button>
          ))}
        </Box>
      </Paper>

      {/* Client Comments Priority Section */}
      {filterType === 'client_comment' && clientChanges.length > 0 && (
        <Card sx={{ mb:  4, border: '2px solid #2196F3', bgcolor: 'rgba(33, 150, 243, 0.03)', borderRadius: 2, boxShadow: '0 2px 8px rgba(33,150,243,0.12)' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, pb: 2, borderBottom: '1px solid rgba(33, 150, 243, 0.2)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#2196F3', width: 48, height: 48 }}>
                  <Comment sx={{ fontSize: '1.5rem' }} />
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ color: '#2196F3', fontWeight: 700}}>
                    Klientkommentarer som krever oppmerksomhet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Gjennomgå og svar på klientenes ønsker
                  </Typography>
                </Box>
                <Chip 
                  label={`${clientChanges.length} nye`}
                  sx={{ ml: 2, bgcolor: '#2196F3', color: 'white', fontWeight: 700, height: 32}}
                />
              </Box>
              {clientChanges.length > 0 && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SelectAll />}
                  onClick={() => {
                    const allClientChangeIds = new Set(clientChanges.map(c => c.id));
                    setSelectedChanges(allClientChangeIds);
                  }}
                >
                  Velg alle
                </Button>
              )}
            </Box>
            
            <List sx={{ '& .MuiListItem-root': { mb: 2 } }}>
              {clientChanges.slice(0, 5).map((change, index) => (
                <React.Fragment key={change.id}>
                  <ListItem
                    sx={{
                      border: '2px solid #2196F3',
                      borderRadius: 2,
                      mb: 2,
                      bgcolor: 'white',
                      p: 2.5,
                      boxShadow: '0 2px 8px rgba(33, 150, 243, 0.12)',
                      '&:hover': {
                        boxShadow: '0 4px 16px rgba(33, 150, 243, 0.2)',
                        transform: 'translateY(-2px)',
                        cursor: 'pointer',
                        borderColor: '#1976D2'
                      },
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    onClick={() => {
                      setSelectedChange(change);
                      setDetailDialogOpen(true);
                    }}
                  >
                    <ListItemIcon>
                      <Checkbox
                        checked={selectedChanges.has(change.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          const newSelected = new Set(selectedChanges);
                          if (newSelected.has(change.id)) {
                            newSelected.delete(change.id);
                          } else {
                            newSelected.add(change.id);
                          }
                          setSelectedChanges(newSelected);
                        }}
                      />
                    </ListItemIcon>
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: '#2196F3', width: 50, height: 50 }}>
                        <Person sx={{ fontSize: 28 }} />
                      </Avatar>
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box>
                          <Typography variant="h6" sx={{  fontWeight: 700, color: '#1976D0', mb:  1  }}>
                            “{change.changeDescription}”
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Person sx={{ fontSize: '1rem' }} />
                            {change.coupleName || change.projectName}
                          </Typography>
                        </Box>
                    }
                      secondary={
                        <Box sx={{ mt:  1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CalendarToday sx={{ fontSize: '0.875rem', color: '#2196F3' }} />
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#2196F3' }}>
                              {formatDate(change.createdAt)}
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            Fra: {change.changedByName || 'Klient'}
                          </Typography>
                        </Box>
                    }
                    />
                    
	                    <ListItemSecondaryAction>
	                      <Button
	                        variant="contained"
	                        size="large"
	                        startIcon={<Visibility />}
	                        onClick={(e) => {
	                          e.stopPropagation();
	                          setSelectedChange(change);
	                          setDetailDialogOpen(true);
	                        }}
	                        sx={{
	                          bgcolor: '#2196F3',
	                          color: 'white',
	                          fontWeight: 600,
	                          px: 3,
	                          textTransform: 'none',
	                          borderRadius: 2,
	                          '&:hover': {
	                            bgcolor: '#1976D2',
	                            transform: 'translateY(-1px)',
	                            boxShadow: '0 4px 8px rgba(33, 150, 243, 0.3)'
	                          },
	                          transition: 'all 0.2s'
	                        }}
	                      >
	                        Les kommentar
	                      </Button>
	                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
            
            {clientChanges.length > 5 && (
              <Box sx={{ textAlign: 'center', mt: 3 }}>
                <Typography variant="body1" sx={{ color: '#2196F0', fontWeight: 600 }}>
                  + {clientChanges.length - 5} flere klientkommentarer venter nedenfor
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Changes */}
      <Card sx={{ mb:  4, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Avatar sx={{ bgcolor: 'rgba(233, 30, 99, 0.1)', color: '#E91E63' }}>
              <TrendingUp />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {filterType === 'client_comment' ? 'Alle klientkommentarer' : 'Siste endringer'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filteredChanges.length} {filteredChanges.length === 1 ? 'endring' : 'endringer'} funnet
              </Typography>
            </Box>
          </Box>
          
          {isLoading ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Box
                sx={{
                  display: 'inline-block',
                  width: 60,
                  height: 60,
                  border: '4px solid rgba(102, 126, 234, 0.1)',
                  borderTopColor: '#667eea',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  '@keyframes spin': {
                    to: { transform: 'rotate(360deg)' }
                  }
                }}
              />
              <Typography variant="body1" sx={{ mt: 3, color: 'text.secondary', fontWeight: 500 }}>
                Laster endringer...
              </Typography>
            </Box>
          ) : filteredChanges.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  margin: '0 auto',
                  mb: 3,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.1
                }}
              >
                <Comment sx={{ fontSize: '4rem', color: 'white' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
                Ingen endringer funnet
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {filterType === 'all' 
                  ? 'Det er ingen endringer å vise akkurat nå' 
                  : `Ingen ${getChangeTypeLabel(filterType).toLowerCase()} funnet`}
              </Typography>
            </Box>
          ) : (
            <List sx={{ '& .MuiListItem-root:last-child': { mb: 0 } }}>
              {filteredChanges.map((change, index) => (
                <React.Fragment key={change.id}>
                  <ListItem
                    sx={{
                      border: change.changedBy === 'client' ? '2px solid #2196F3' : '1px solid',
                      borderColor: change.changedBy === 'client' ? '#2196F3' : 'divider',
                      borderRadius: 2,
                      mb: 1.5,
                      p: 2,
                      bgcolor: change.changedBy === 'client' ? 'rgba(33, 150, 243, 0.04)' : 'background.paper',
                      boxShadow: change.changedBy === 'client' ? '0 1px 4px rgba(33, 150, 243, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
                      '&:hover': {
                        bgcolor: change.changedBy === 'client' ? 'rgba(33, 150, 243, 0.08)' : 'rgba(0, 0, 0, 0.02)',
                        cursor: 'pointer',
                        transform: 'translateY(-1px)',
                        boxShadow: change.changedBy === 'client' ? '0 2px 8px rgba(33, 150, 243, 0.15)' : '0 2px 4px rgba(0, 0, 0, 0.08)',
                        borderColor: change.changedBy === 'client' ? '#1976D2' : 'rgba(0, 0, 0, 0.2)'
                      },
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    onClick={() => {
                      setSelectedChange(change);
                      setDetailDialogOpen(true);
                    }}
                  >
                    <ListItemIcon>
                      <Checkbox
                        checked={selectedChanges.has(change.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          const newSelected = new Set(selectedChanges);
                          if (newSelected.has(change.id)) {
                            newSelected.delete(change.id);
                          } else {
                            newSelected.add(change.id);
                          }
                          setSelectedChanges(newSelected);
                        }}
                      />
                    </ListItemIcon>
                    <ListItemIcon>
                      <Avatar
                        sx={{
                          bgcolor: change.changedBy === 'client' ? '#2196F3' : getChangeTypeColor(change.changeType),
                          width: change.changedBy === 'client' ? 50 : 40,
                          height: change.changedBy === 'client' ? 50 : 40,
                          border: change.changedBy === 'client' ? '3px solid #1976D2' : 'none'}}
                      >
                        {change.changedBy === 'client'
                          ? <Person sx={{ fontSize: change.changedBy === 'client' ? 28 : 20 }} />
                          : getChangeTypeIcon(change.changeType)}
                      </Avatar>
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
                          {change.changedBy === 'client' && (
                            <Chip 
                              icon={<Notifications sx={{ fontSize: '0.875rem' }} />}
                              label="KLIENT"
                              size="small"
                              sx={{ 
                                bgcolor: '#2196F3',
                                color: 'white',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                mr: 1
                              }}
                            />
                          )}
                          <Typography variant={change.changedBy === 'client' ? 'h6' : 'subtitle1'} sx={{ 
                            fontWeight: change.changedBy === 'client' ? 700 : 600,
                            color: change.changedBy === 'client' ? '#1976D2' : 'inherit'
                      }}>
                            {change.changedBy === 'client' ? `"${change.changeDescription}"` : change.changeDescription}
                          </Typography>
                          <Chip 
                            label={getChangeTypeLabel(change.changeType)}
                            size="small"
                            variant={change.changedBy === 'client' ? 'outlined' : 'filled'}
                            sx={{ 
                              bgcolor: change.changedBy === 'client' ? 'transparent' : getChangeTypeColor(change.changeType),
                              borderColor: change.changedBy === 'client' ? '#2196F3' : 'transparent',
                              color: change.changedBy === 'client' ? '#2196F3' : 'white',
                              fontSize: '0.75rem'
                        }}
                          />
                        </Box>
                    }
                      secondary={
                        <Box sx={{ mt:  1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Person sx={{ fontSize: '1rem', color: change.changedBy === 'client' ? '#1976D2' : 'text.secondary' }} />
                            <Typography variant="body1" sx={{ 
                              fontWeight: change.changedBy === 'client' ? 600 : 500,
                              color: change.changedBy === 'client' ? '#1976D2' : 'text.primary'
                            }}>
                              {change.coupleName || change.projectName}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ 
                            color: change.changedBy === 'client' ? '#2196F3' : 'text.secondary',
                            fontWeight: change.changedBy === 'client' ? 600 : 400,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5
                          }}>
                            {change.changedBy === 'client' ? <Person sx={{ fontSize: '0.875rem' }} /> : <PhotoCamera sx={{ fontSize: '0.875rem' }} />}
                            {change.changedByName} • {formatDate(change.createdAt)}
                          </Typography>
                        </Box>
                    }
                    />
                    
                    <ListItemSecondaryAction>
                      <Tooltip title={change.changedBy === 'client' ? 'Les klientkommentar' : 'Se detaljer'}>
                        <Button
                          size={change.changedBy === 'client' ? 'large' : 'small'}
                          variant={change.changedBy === 'client' ? 'contained' : 'outlined'}
                          startIcon={theming.getThemedIcon('visibility')}
	                          sx={{
	                            borderColor: change.changedBy === 'client' ? '#2196F3' : getChangeTypeColor(change.changeType),
	                            color: change.changedBy === 'client' ? 'white' : getChangeTypeColor(change.changeType),
	                            bgcolor: change.changedBy === 'client' ? '#2196F3' : 'transparent',
                              fontWeight: change.changedBy === 'client' ? 600 : 400,
	                            px: change.changedBy === 'client' ? 3 : 2, '&:hover': {
                                bgcolor: change.changedBy === 'client' ? '#1976D2' : 'rgba(0, 0, 0, 0.04)',
	                            }}}
                        >
                          {change.changedBy === 'client' ? 'Les kommentar' : 'Detaljer'}
                        </Button>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Changes by Timeline */}
      {changesData && Object.keys(changesData.changesByTimeline || {}).length > 0 && (
        <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Avatar sx={{ bgcolor: 'rgba(233, 30, 99, 0.1)', color: '#E91E63' }}>
                <Group />
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Endringer gruppert etter bryllup
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {Object.keys(changesData.changesByTimeline || {}).length} aktive bryllup
                </Typography>
              </Box>
            </Box>
            
            {Object.values(changesData.changesByTimeline).map((timeline) => (
              <Accordion 
                key={timeline.timelineId} 
                sx={{ 
                  mb: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': {
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                  }
                }}
              >
                <AccordionSummary 
                  expandIcon={<ExpandMore />}
                  sx={{
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.02)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%'}}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, flex:  1 }}>
                      {timeline.coupleName || timeline.projectName}
                    </Typography>
                    <Badge 
                      badgeContent={timeline.changes.length}
                      color="primary"
                      sx={{ mr:  2 }}
                    >
                      <Message />
                    </Badge>
                    {timeline.weddingDate && (
                      <Typography variant="body2" color="text.secondary">
                        {new Date(timeline.weddingDate).toLocaleDateString('no-NO')}
                      </Typography>
                    )}
                  </Box>
                </AccordionSummary>
                
                <AccordionDetails sx={{ bgcolor: 'rgba(0, 0, 0, 0.01)' }}>
                  <List dense sx={{ '& .MuiListItem-root': { py: 1 } }}>
                    {timeline.changes.slice(0, 5).map((change) => (
                      <ListItem 
                        key={change.id} 
                        sx={{ 
                          pl: 0,
                          borderRadius: 1,
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.02)'
                          }
                        }}
                      >
                        <ListItemIcon>
                          {getChangeTypeIcon(change.changeType)}
                        </ListItemIcon>
                        <ListItemText
                          primary={change.changeDescription}
                          secondary={`${change.changedByName} • ${formatDate(change.createdAt)}`}
                        />
                        <Chip 
                          label={getChangeTypeLabel(change.changeType)}
                          size="small"
                          variant="outlined"
                          sx={{ 
                            borderColor: getChangeTypeColor(change.changeType),
                            color: getChangeTypeColor(change.changeType)
                      }}
                        />
                      </ListItem>
                    ))}
                    
                    {timeline.changes.length > 5 && (
                      <ListItem sx={{ pl:  0 }}>
                        <ListItemText
                          primary={
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic'}}>
                              ... og {timeline.changes.length - 5} flere endringer
                            </Typography>
                        }
                        />
                      </ListItem>
                    )}
                  </List>
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Change Detail Dialog */}
      <Dialog 
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center'}}>
          {selectedChange && getChangeTypeIcon(selectedChange.changeType)}
          <Typography variant="h6" sx={{  ml:  1  }}>
            Endringsdetaljer
          </Typography>
        </DialogTitle>
        
        <DialogContent>
          {selectedChange && (
            <Box>
              <Paper sx={{ p:  3, mb:  3, bgcolor: 'rgba(233, 30, 99, 0.02)', borderRadius: 2 }}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  {selectedChange.changeDescription}
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Bryllup: </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {selectedChange.coupleName || selectedChange.projectName || 'Ikke spesifisert'}
                    </Typography>
                  </Grid>
                  
                  <Grid size={{ xs: 12 }} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Endret av: </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {selectedChange.changedByName} ({selectedChange.changedBy === 'client' ? 'Klient' : 'Fotograf'})
                    </Typography>
                  </Grid>
                  
                  <Grid size={{ xs: 12 }} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Dato og tid: </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {formatDate(selectedChange.createdAt)}
                    </Typography>
                  </Grid>
                  
                  <Grid size={{ xs: 12 }} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Type endring: </Typography>
                    <Chip 
                      label={getChangeTypeLabel(selectedChange.changeType)}
                      sx={{ 
                        bgcolor: getChangeTypeColor(selectedChange.changeType),
                        color: 'white'
                  }}
                    />
                  </Grid>
                </Grid>
              </Paper>
              
              {selectedChange.oldValue && selectedChange.newValue && (
                <Paper sx={{ p:  3, mb:  3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="h6" sx={{  mb:  2  }}>
                    Endringsdetaljer
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }} md={6}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                        Gammel verdi: </Typography>
                      <Paper sx={{ p: 2, bgcolor: 'rgba(244, 67, 54, 0.08)', borderRadius: 1, border: '1px solid rgba(244, 67, 54, 0.2)' }}>
                        <Typography variant="body2">
                          {selectedChange.oldValue}
                        </Typography>
                      </Paper>
                    </Grid>
                    
                    <Grid size={{ xs: 12 }} md={6}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                        Ny verdi: </Typography>
                      <Paper sx={{ p: 2, bgcolor: 'rgba(76, 175, 80, 0.08)', borderRadius: 1, border: '1px solid rgba(76, 175, 80, 0.2)' }}>
                        <Typography variant="body2">
                          {selectedChange.newValue}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Paper>
              )}
              
              {selectedChange.changeDetails && Object.keys(selectedChange.changeDetails).length > 0 && (
                <Paper sx={{ p:  3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="h6" sx={{  mb:  2  }}>
                    Ytterligere detaljer
                  </Typography>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem'}}>
                    {JSON.stringify(selectedChange.changeDetails, null, 2)}
                  </pre>
                </Paper>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          {selectedChange?.changedBy === 'client' && (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Cancel />}
                onClick={async () => {
                  try {
                    await apiRequest(`/api/wedding-timeline/changes/${selectedChange.id}/reject`, {
                      method: 'PUT',
                    });
                    setDetailDialogOpen(false);
                    refetch();
                  } catch (error) {
                    console.error('Failed to reject change:', error);
                  }
                }}
              >
                Avvis
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircle />}
                onClick={async () => {
                  try {
                    await apiRequest(`/api/wedding-timeline/changes/${selectedChange.id}/approve`, {
                      method: 'PUT',
                    });
                    setDetailDialogOpen(false);
                    refetch();
                  } catch (error) {
                    console.error('Failed to approve change:', error);
                  }
                }}
                sx={theming.getThemedButtonSx()}
              >
                Godkjenn
              </Button>
            </>
          )}
          <Button onClick={() => setDetailDialogOpen(false)}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change History Timeline */}
      {showHistory && (
        <Card sx={{ mt: 4, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <History sx={{ color: theming.colors.primary }} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Endringshistorikk
              </Typography>
            </Box>
            
            <Box sx={{ position: 'relative', pl: 4 }}>
              <Box sx={{
                position: 'absolute',
                left: 15,
                top: 20,
                bottom: 20,
                width: 2,
                bgcolor: theming.colors.primary,
                borderRadius: 1
              }} />
              
              {filteredChanges.map((change, index) => (
                <Box key={change.id} sx={{ position: 'relative', mb: 3 }}>
                  <Box sx={{
                    position: 'absolute',
                    left: -25,
                    top: 5,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: change.changedBy === 'client' ? '#2196F3' : getChangeTypeColor(change.changeType),
                    border: '3px solid white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {change.changedBy === 'client' ? (
                      <Person sx={{ fontSize: 12, color: 'white' }} />
                    ) : (
                      getChangeTypeIcon(change.changeType)
                    )}
                  </Box>
                  
                  <Paper sx={{ p: 2, ml: 2, bgcolor: 'rgba(33, 150, 243, 0.04)', borderRadius: 1, border: '1px solid rgba(33, 150, 243, 0.2)' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      {formatDate(change.createdAt)}
                    </Typography>
                    <Typography variant="body2">
                      {change.changeDescription}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {change.changedByName} ({change.changedBy === 'client' ? 'Klient' : 'Fotograf'})
                    </Typography>
                  </Paper>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}