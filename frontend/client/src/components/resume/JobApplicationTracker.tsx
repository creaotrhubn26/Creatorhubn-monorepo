/**
 * CreatorHub Norge - Job Application Tracker
 * Track job applications from Norwegian job sites (finn.no, nav.no, etc.)
 */

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Stack,
  Alert,
  LinearProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Avatar,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  Business as CompanyIcon,
  LocationOn as LocationIcon,
  CalendarToday as DateIcon,
  Flag as PriorityIcon,
  Assessment as StatusIcon,
  Notes as NotesIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

// Norwegian Job Sources
const NORWEGIAN_JOB_SOURCES = [
  { value: 'finn.no', label: 'Finn.no', url: 'https://www.finn.no/job/fulltime/search.html', color: '#06befb' },
  { value: 'nav.no', label: 'NAV', url: 'https://arbeidsplassen.nav.no', color: '#c30000' },
  { value: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/jobs', color: '#0077b5' },
  { value: 'jobbnorge.no', label: 'Jobbnorge', url: 'https://www.jobbnorge.no', color: '#003d5c' },
  { value: 'karrierestart.no', label: 'Karrierestart', url: 'https://www.karrierestart.no', color: '#00a651' },
  { value: 'glassdoor', label: 'Glassdoor', url: 'https://www.glassdoor.com/Job/norway-jobs-SRCH_IL.0,6_IN177.htm', color: '#0caa41' },
  { value: 'indeed', label: 'Indeed', url: 'https://no.indeed.com', color: '#2164f3' },
  { value: 'other', label: 'Annet', url: ',', color: '#757575' },
];

const STATUS_OPTIONS = [
  { value: 'saved', label: 'Lagret', color: 'default' as const },
  { value: 'applied', label: 'Søkt', color: 'primary' as const },
  { value: 'interviewing', label: 'Intervju', color: 'info' as const },
  { value: 'offer', label: 'Tilbud', color: 'success' as const },
  { value: 'rejected', label: 'Avvist', color: 'error' as const },
  { value: 'accepted', label: 'Akseptert', color: 'success' as const },
  { value: 'withdrawn', label: 'Trukket', color: 'warning' as const },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Lav', color: 'default' as const },
  { value: 'medium', label: 'Middels', color: 'warning' as const },
  { value: 'high', label: 'Høy', color: 'error' as const },
];

interface JobApplication {
  id: string;
  userId: string;
  resumeId?: string;
  jobTitle: string;
  company: string;
  location?: string;
  jobUrl?: string;
  source?: string;
  status: 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'accepted' | 'withdrawn';
  appliedDate?: string;
  responseDate?: string;
  interviewDate?: string;
  offerDate?: string;
  coverLetter?: string;
  notes?: string;
  salary?: string;
  followUpDate?: string;
  reminderSent: boolean;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export default function JobApplicationTracker() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [openDialog, setOpenDialog] = useState(false);
  const [editingApplication, setEditingApplication] = useState<JobApplication | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState<Partial<JobApplication>>({
    jobTitle: '',
    company: '',
    location: '',
    jobUrl: '',
    source: 'finn.no',
    status: 'saved',
    priority: 'medium',
    notes: '',
    salary: '',
    tags: [],
  });

  // Fetch applications
  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['job-applications,', user?.id],
    queryFn: async () => {
      const response = await apiRequest('/api/job-applications, ', {
        headers: { 'x-user-id': user?.id || ',' },
      });
      return response as JobApplication[];
    },
    enabled: !!user?.id,
  });

  // Create application mutation
  const createApplicationMutation = useMutation({
    mutationFn: async (data: Partial<JobApplication>) => {
      const response = await apiRequest('/api/job-applications', {
        method: 'POST',
        headers: {
          'x-user-id': user?.id || ',','Content-Type' : 'application/json',
        },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-applications'] });
      handleCloseDialog();
    },
  });

  // Update application mutation
  const updateApplicationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<JobApplication> }) => {
      const response = await apiRequest(`/api/job-applications/${id}`, {
        method: 'PUT',
        headers: {
          'x-user-id': user?.id || ',','Content-Type' : 'application/json',
        },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-applications'] });
      handleCloseDialog();
    },
  });

  // Delete application mutation
  const deleteApplicationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/job-applications/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || ',' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-applications'] });
    },
  });

  // Handlers
  const handleOpenDialog = (application?: JobApplication) => {
    if (application) {
      setEditingApplication(application);
      setFormData(application);
    } else {
      setEditingApplication(null);
      setFormData({
        jobTitle: '',
        company: '',
        location: ', ',
        jobUrl: ', ',
        source: 'finn.no',
        status: 'saved',
        priority: 'medium',
        notes: ', ',
        salary: ', ',
        tags: [],
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingApplication(null);
  };

  const handleSubmit = () => {
    if (editingApplication) {
      updateApplicationMutation.mutate({
        id: editingApplication.id,
        data: formData,
      });
    } else {
      createApplicationMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Er du sikker på at du vil slette denne søknaden?')) {
      deleteApplicationMutation.mutate(id);
    }
  };

  const handleOpenJobSite = (url: string) => {
    window.open(url, '_blank');
  };

  // Filter applications by status
  const filterByStatus = (status: string | null) => {
    if (!status) return applications;
    return applications.filter((app) => app.status === status);
  };

  // Get applications by current tab
  const getApplicationsByTab = () => {
    switch (tabValue) {
      case 0:
        return applications; // All
      case 1:
        return filterByStatus('saved'); // Saved
      case 2:
        return filterByStatus('applied'); // Applied
      case 3:
        return filterByStatus('interviewing'); // Interviewing
      case 4:
        return [...filterByStatus('offer'), ...filterByStatus('accepted')]; // Offers
      default:
        return applications;
    }
  };

  const displayedApplications = getApplicationsByTab();

  // Statistics
  const stats = {
    total: applications.length,
    saved: filterByStatus('saved').length,
    applied: filterByStatus('applied').length,
    interviewing: filterByStatus('interviewing').length,
    offers: filterByStatus('offer').length + filterByStatus('accepted').length,
    rejected: filterByStatus('rejected').length,
  };

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="warning">
          Vennligst logg inn for å bruke jobbsøknadssporing
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom sx={{ fontWeight: 700}}>
          Jobbsøknadssporing
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Hold oversikt over alle dine jobbsøknader fra norske jobbsider
        </Typography>
      </Box>

      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="primary">
                {stats.total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totalt
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="info.main">
                {stats.saved}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Lagret
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="primary.main">
                {stats.applied}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Søkt
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="warning.main">
                {stats.interviewing}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Intervju
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="success.main">
                {stats.offers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tilbud
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="error.main">
                {stats.rejected}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avvist
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Norwegian Job Sites Quick Links */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Norske jobbsider
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {NORWEGIAN_JOB_SOURCES.map((source) => (
              <Chip
                key={source.value}
                label={source.label}
                clickable
                onClick={() => handleOpenJobSite(source.url)}
                sx={{
                  bgcolor: source.color,
                  color: 'white', '&:hover': {
                    bgcolor: source.color,
                    opacity: 0.8,
                  }}}
                icon={<SearchIcon sx={{ color: 'white !important' }} />}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Actions */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Legg til søknad
        </Button>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => queryClient.invalidateQueries({ queryKey: ['job-applications'] })}
        >
          Oppdater
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 3 }}>
        <Tab label={`Alle (${stats.total})`} />
        <Tab label={`Lagret (${stats.saved})`} />
        <Tab label={`Søkt (${stats.applied})`} />
        <Tab label={`Intervju (${stats.interviewing})`} />
        <Tab label={`Tilbud (${stats.offers})`} />
      </Tabs>

      {/* Applications List */}
      {isLoading ? (
        <LinearProgress />
      ) : displayedApplications.length === 0 ? (
        <Alert severity="info">
          Ingen søknader funnet. Legg til din første jobbsøknad!
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {displayedApplications.map((application) => {
            const statusInfo = STATUS_OPTIONS.find((s) => s.value === application.status);
            const priorityInfo = PRIORITY_OPTIONS.find((p) => p.value === application.priority);
            const sourceInfo = NORWEGIAN_JOB_SOURCES.find((s) => s.value === application.source);

            return (
              <Grid item xs={12} md={6} lg={4} key={application.id}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    {/* Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" noWrap sx={{ flex: 1 }}>
                        {application.jobTitle}
                      </Typography>
                      <Chip
                        label={statusInfo?.label}
                        size="small"
                        color={statusInfo?.color}
                      />
                    </Box>

                    {/* Company & Location */}
                    <Stack spacing={1} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CompanyIcon fontSize="small" color="action" />
                        <Typography variant="body2">{application.company}</Typography>
                      </Box>
                      {application.location && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LocationIcon fontSize="small" color="action" />
                          <Typography variant="body2">{application.location}</Typography>
                        </Box>
                      )}
                    </Stack>

                    {/* Source */}
                    {sourceInfo && (
                      <Chip
                        label={sourceInfo.label}
                        size="small"
                        sx={{
                          bgcolor: sourceInfo.color,
                          color: 'white',
                          mb: 2}}
                      />
                    )}

                    {/* Priority */}
                    <Chip
                      icon={<PriorityIcon />}
                      label={priorityInfo?.label}
                      size="small"
                      color={priorityInfo?.color}
                      sx={{ ml: 1 }}
                    />

                    {/* Dates */}
                    {application.appliedDate && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                        Søkt: {new Date(application.appliedDate).toLocaleDateString('no-NO')}
                      </Typography>
                    )}

                    {/* Notes Preview */}
                    {application.notes && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }} noWrap>
                        {application.notes}
                      </Typography>
                    )}
                  </CardContent>

                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleOpenDialog(application)}
                    >
                      Rediger
                    </Button>
                    {application.jobUrl && (
                      <Button
                        size="small"
                        startIcon={<LinkIcon />}
                        onClick={() => handleOpenJobSite(application.jobUrl!)}
                      >
                        Åpne
                      </Button>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(application.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingApplication ? 'Rediger søknad' : 'Legg til søknad'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Stillingstittel"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Bedrift"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Sted"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Lenke til stillingsannonse"
                value={formData.jobUrl}
                onChange={(e) => setFormData({ ...formData, jobUrl: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Kilde</InputLabel>
                <Select
                  value={formData.source}
                  label="Kilde"
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                >
                  {NORWEGIAN_JOB_SOURCES.map((source) => (
                    <MenuItem key={source.value} value={source.value}>
                      {source.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Prioritet</InputLabel>
                <Select
                  value={formData.priority}
                  label="Prioritet"
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <MenuItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Lønn"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="Søknadsdato"
                value={formData.appliedDate || ''}
                onChange={(e) => setFormData({ ...formData, appliedDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Notater"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.jobTitle || !formData.company}
          >
            {editingApplication ? 'Oppdater' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

