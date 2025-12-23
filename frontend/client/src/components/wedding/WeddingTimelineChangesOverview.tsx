import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  History
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
  const theming = useTheming(profession || 'photographer,');

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
      default: return <Timeline sx={{ color: '#9E9E9E'}} />;
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

  const filteredChanges = changesData?.recentChanges.filter(change => {
    // Primary filter by type
    const typeMatch = filterType === 'all, ' || change.changeType === filterType;
    
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
    const client = changesData.recentChanges.filter(c => c.changedBy === 'client').length;
    const photographer = changesData.recentChanges.filter(c => c.changedBy === 'photographer').length;
    
    return { total, client, photographer };
};

  const activitySummary = getActivitySummary();

  return (
    <Box sx={{ p:  3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Comment sx={{ color: theming.colors.primary, fontSize: '2rem' }} />
            <Typography variant="h4" sx={{ fontWeight: 600, color: theming.colors.primary }}>
              Klientendringer - Bryllupstidslinjer
            </Typography>
          </Box>
          
          <Typography variant="body1" sx={{ color: 'text.secondary'}}>
            Alle kommentarer og ønsker fra dine bryllupspar
          </Typography>
          
          {clientChanges.length > 0 && (
            <Alert 
              severity="info" 
              sx={{ mt: 2, bgcolor: 'rgba(3, 150, 243, 0.1)', border: '1px solid #2196F3'}}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Notifications sx={{ color: '#2196F3' }} />
                <Typography variant="body2" sx={{ fontWeight: 600}}>
                  {clientChanges.length} nye kommentarer fra kunder venter på gjennomgang
                </Typography>
              </Box>
            </Alert>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                checked={showHistory}
                onChange={(e) => setShowHistory(e.target.checked)}
              />
            }
            label="Vis historikk"
          />
          
          <Button
            variant={showOnlyNewChanges ? 'contained' : 'outlined'}
            onClick={() => setShowOnlyNewChanges(!showOnlyNewChanges)}
            sx={{
              borderColor: '#FF9800',
              color: showOnlyNewChanges ? 'white' : '#FF9800',
              bgcolor: showOnlyNewChanges ? '#FF9800' : 'transparent'
            }}
          >
            Kun nye (24t)
          </Button>
          
          {selectedChanges.size > 0 && (
            <ButtonGroup>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircle />}
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
              >
                Godkjenn ({selectedChanges.size})
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<Cancel />}
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
              >
                Avvis ({selectedChanges.size})
              </Button>
            </ButtonGroup>
          )}
          
          <Button
            variant="outlined"
            onClick={() => refetch()}
            startIcon={<Refresh />}
            sx={{
              borderColor: '#E91E60',
              color: '#E91E60', '&:hover': {
                borderColor: '#C21850',
                bgcolor: 'rgba(23, 30, 99, 0.04)'
              }
            }}
          >
            Oppdater
          </Button>
        </Box>
      </Box>

      {/* Activity Summary Cards */}
      <Grid container spacing={3} sx={{ mb:  4 }}>
        <Grid size={{ xs: 12 }} md={3}>
          <Card sx={{ bgcolor: 'rgba(23, 30, 99, 0.1)', border: '1px solid #E91E63',  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  color: '#E91E60', fontWeight: 600}}>
                {activitySummary.total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totale endringer
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12 }} md={3}>
          <Card sx={{ bgcolor: 'rgba(3, 150, 243, 0.1)', border: '1px solid #2196F3',  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  color: '#2196F0', fontWeight: 600}}>
                {activitySummary.client}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Klient kommentarer
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12 }} md={3}>
          <Card sx={{ bgcolor: 'rgba(6, 175, 80, 0.1)', border: '1px solid #4CAF50',  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  color: '#4CAF50', fontWeight: 600}}>
                {activitySummary.photographer}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Dine oppdateringer
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12 }} md={3}>
          <Card sx={{ bgcolor: 'rgba(25, 1520.1)', border: '1px solid #FF9800',  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  color: '#FF9800', fontWeight: 600}}>
                {Object.keys(changesData?.changesByTimeline || {}).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktive tidslinjer
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Buttons */}
      <Box sx={{ mb:  3 }}>
        <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center' }}>
          <FilterList sx={{ mr:  1 }} />
          Filtrer endringer
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
          {[
            { key: 'client_comment', label: `Klient kommentarer (${clientChanges.length})`, icon: Comment, priority: true },
            { key: 'photographer_update', label: `Dine oppdateringer (${photographerChanges.length})`, icon: Edit },
            { key: 'all', label: 'Alle endringer', icon: TimelineIcon },
            { key: 'status_change', label: 'Status endringer', icon: Schedule }
          ].map(({ key, label, icon: Icon, priority }) => (
            <Button
              key={key}
              variant={filterType === key ? 'contained' : 'outlined'}
              onClick={() => setFilterType(key)}
              startIcon={<Icon />}
              size={priority ? 'large' : 'medium'}
              sx={{
                borderColor: getChangeTypeColor(key === 'all' ? 'photographer_update' : key),
                color: filterType === key ? 'white' : getChangeTypeColor(key === 'all' ? 'photographer_update' : key),
                bgcolor: filterType === key ? getChangeTypeColor(key === 'all' ? 'photographer_update' : key) : 'transparent',
                fontWeight: riority ? 700 : 50,
                fontSize: priority ? '1rem' : '0.875rem',
                border: priority ? '2px solid' : '1px solid',
                boxShadow: priority && filterType === key ? '0 4px 12px rgba(3, 150, 243, 0.3)' : 'none','&:hover': {
                  bgcolor: filterType === key 
                    ? getChangeTypeColor(key === 'all' ? 'photographer_update' : key)
                    : `rgba(${key === 'all' ? '23, 30, 99' : key === 'client_comment' ? '33, 150, 243' : key === 'photographer_update' ? '233, 30, 99' : '76, 175, 80'}, 0.08)`,
                  transform: priority ? 'translateY(-1px)' : 'none'
            }
            }}
            >
              {label}
            </Button>
          ))}
        </Box>
      </Box>

      {/* Client Comments Priority Section */}
      {filterType === 'client_comment' && clientChanges.length > 0 && (
        <Card sx={{ mb:  4, border: '2px solid #2196F0', bgcolor: 'rgba(3, 150, 243, 0.02)' ,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Comment sx={{ color: '#2196F0', fontSize: '1.5rem' }} />
                <Typography variant="h5" sx={{ color: '#2196F0', fontWeight: 700}}>
                  Klientkommentarer som krever oppmerksomhet
                </Typography>
                <Chip 
                  label={`${clientChanges.length} nye`}
                  sx={{ ml: 2, bgcolor: '#2196F0', color: 'white', fontWeight: 600}}
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
            
            <List>
              {clientChanges.slice(0, 5).map((change, index) => (
                <React.Fragment key={change.id}>
                  <ListItem
                    sx={{
                      border: '2px solid #2196F0',
                      borderRadius: 3,
                      mb: 2,
                      bgcolor: 'white',
                      boxShadow: '0 4px 12px rgba(3, 150, 243, 0.15)','&:hover': {
                        boxShadow: '0 6px 20px rgba(3, 150, 243, 0.25)',
                        transform: 'translateY(-2px)',
                        cursor: 'pointer'
                      },
                      transition: 'all 0.2s ease-in-out'
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
                      <Avatar sx={{ bgcolor: '#2196F0', width: 50, height: 50 }}>
                        <Person sx={{ fontSize: 28 }} />
                      </Avatar>
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box>
                          <Typography variant="h6" sx={{  fontWeight: 7, color: '#1976D0', mb:  1  }}>
                            "{change.changeDescription},"
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
	                        startIcon={theming.getThemedIcon('visibility')}
	                        sx={{
	                          bgcolor: '#2196F0',
	                          color: 'white',
	                          fontWeight: 600,
	                          px: 3, '&:hover': {
	                            bgcolor: '#1976D2',
	                          },
	                          ...theming.getThemedButtonSx()}}
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
      <Card sx={{ mb:  4 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" sx={{  mb:  3, display: 'flex', alignItems: 'center' }}>
            <TrendingUp sx={{ mr: 1, color: '#E91E63'}} />
            {filterType === 'client_comment' ? 'Alle klientkommentarer' : 'Siste endringer'} ({filteredChanges.length})
          </Typography>
          
          {isLoading ? (
            <Box sx={{ textAlign: 'center', py:  4 }}>
              <Typography color="text.secondary">Laster endringer...</Typography>
            </Box>
          ) : filteredChanges.length === 0 ? (
            <Box sx={{ textAlign: 'center', py:  4 }}>
              <Typography color="text.secondary">
                {filterType === 'all' ? 'Ingen endringer funnet' : `Ingen ${getChangeTypeLabel(filterType).toLowerCase()} funnet`}
              </Typography>
            </Box>
          ) : (
            <List>
              {filteredChanges.map((change, index) => (
                <React.Fragment key={change.id}>
                  <ListItem
                    sx={{
                      border: change.changedBy === 'client' ? '2px solid #2196F3' : '1px solid',
                      borderColor: change.changedBy === 'client' ? '#2196F3' : 'divider',
                      borderRadius: 2,
                      mb: 2,
                      bgcolor: change.changedBy === 'client' ? 'rgba(3, 150, 243, 0.05)' : 'white',
                      boxShadow: change.changedBy === 'client' ? '0 2px 8px rgba(3, 150, 243, 0.15)' : 'none', '&:hover': {
                        bgcolor: change.changedBy === 'client' ? 'rgba(3, 150, 243, 0.08)' : 'rgba(0, 0, 0, 0.02)',
                        cursor: 'pointer',
                        transform: 'translateY(-1px)',
                        boxShadow: change.changedBy === 'client' ? '0 4px 12px rgba(3, 150, 243, 0.25)' : '0 2px 4px rgba(0, 0, 0, 0.1)'
                      },
                      transition: 'all 0.2s ease-in-out'
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
                                bgcolor: '#2196F0',
                                color: 'white',
                                fontWeight: 7,
                                fontSize: '0.75rem',
                                mr: 1 }}
                            />
                          )}
                          <Typography variant={change.changedBy === 'client' ? 'h6' : 'subtitle1'} sx={{ 
                            fontWeight: hange.changedBy === 'client' ? 700 : 60,
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
                              fontWeight: hange.changedBy === 'client' ? 600 : 500,
                              color: change.changedBy === 'client' ? '#1976D2' : 'text.primary'
                            }}>
                              {change.coupleName || change.projectName}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ 
                            color: change.changedBy === 'client' ? '#2196F3' : 'text.secondary',
                            fontWeight: hange.changedBy === 'client' ? 600 : 400,
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
	                            fontWeight: hange.changedBy === 'client' ? 600 : 400,
	                            px: change.changedBy === 'client' ? 3 : 2, '&:hover': {
	                              bgcolor:
	                                change.changedBy === 'client'
	                                  ? '#1976D2'
	                                  : `rgba(${getChangeTypeColor(change.changeType).slice()}, 0.08)`,
	                            }}}
                        >
                          {change.changedBy === 'client' ? 'Les kommentar' : 'Detaljer'}
                        </Button>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                  
                  {index < filteredChanges.length - 1 && <Divider sx={{ my:  1 }} />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Changes by Timeline */}
      {changesData && Object.keys(changesData.changesByTimeline).length > 0 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" sx={{  mb:  3, display: 'flex', alignItems: 'center' }}>
              <Group sx={{ mr: 1, color: '#E91E63'}} />
              Endringer gruppert etter bryllup
            </Typography>
            
            {Object.values(changesData.changesByTimeline).map((timeline) => (
              <Accordion key={timeline.timelineId} sx={{ mb:  2 }}>
                <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
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
                
                <AccordionDetails>
                  <List dense>
                    {timeline.changes.slice(0, 5).map((change) => (
                      <ListItem key={change.id} sx={{ pl:  0 }}>
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
              <Paper sx={{ p:  3, mb:  3, bgcolor: 'rgba(23, 30, 99, 0.02)' ,  ...theming.getThemedCardSx() }}>
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
                <Paper sx={{ p:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb:  2  }}>
                    Endringsdetaljer
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }} md={6}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                        Gammel verdi: </Typography>
                      <Paper sx={{ p: 2, bgcolor: 'rgba(24, 67, 54, 0.1)' ,  ...theming.getThemedCardSx() }}>
                        <Typography variant="body2">
                          {selectedChange.oldValue}
                        </Typography>
                      </Paper>
                    </Grid>
                    
                    <Grid size={{ xs: 12 }} md={6}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                        Ny verdi: </Typography>
                      <Paper sx={{ p: 2, bgcolor: 'rgba(6, 175, 80, 0.1)' ,  ...theming.getThemedCardSx() }}>
                        <Typography variant="body2">
                          {selectedChange.newValue}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Paper>
              )}
              
              {selectedChange.changeDetails && Object.keys(selectedChange.changeDetails).length > 0 && (
                <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
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
        <Card sx={{ mt: 4, ...theming.getThemedCardSx() }}>
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
                  
                  <Paper sx={{ p: 2, ml: 2, ...theming.getThemedCardSx() }}>
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