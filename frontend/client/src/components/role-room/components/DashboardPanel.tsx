// @ts-nocheck
import { useId, useMemo, useState, useEffect, memo, lazy, Suspense } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Tooltip,
  LinearProgress as _LinearProgress,
  CircularProgress,
  useTheme,
  useMediaQuery,
  TextField,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Share as ShareIcon,
  ViewKanban as _ViewKanbanIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CheckCircle as _CheckCircleIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import DashboardGuide from './DashboardGuide';
import { 
  DashboardCustomIcon as DashboardIcon, 
  CalendarCustomIcon as CalendarIcon, 
  LocationsIcon as LocationIcon,
  TrendingIcon as TrendingUpIcon,
  RolesIcon,
  CandidatesIcon,
  TeamIcon,
  PropsIcon,
  ShotListIcon,
  AuditionsIcon,
} from './icons/CastingIcons';
import type { CastingProject, Role, Candidate, Schedule } from '../models/casting';
import { castingService } from '../services/castingService';
import { useToast } from './ToastStack';

const KanbanPanelLazy = lazy(() =>
  import('./KanbanPanel').then(m => ({ default: m.KanbanPanel }))
);

// WCAG 2.2 - 2.5.5 Target Size: minimum 44x44px touch targets
const TOUCH_TARGET_SIZE = 44;

// WCAG 2.2 - 2.4.7 Focus Visible: clear focus indicator
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #8b5cf6',
    outlineOffset: 2,
  },
};

interface DashboardPanelProps {
  project: CastingProject | null;
  roles: Role[];
  candidates: Candidate[];
  schedules: Schedule[];
  onNavigateToTab: (tabIndex: number) => void;
  onCreateRole: () => void;
  onCreateCandidate: () => void;
  onCreateSchedule: () => void;
  onOpenSharing: () => void;
  onUpdate?: () => void;
  onEditCandidate?: (candidate: Candidate) => void;
  onCandidatesChange?: () => void;
  profession?: 'photographer' | 'videographer' | null;
}

function DashboardPanelInner({
  project,
  roles,
  candidates,
  schedules,
  onNavigateToTab,
  onCreateRole,
  onCreateCandidate,
  onCreateSchedule,
  onOpenSharing,
  onUpdate,
  onEditCandidate,
  onCandidatesChange,
  profession: _profession,
}: DashboardPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const _isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const _isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const titleId = useId();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const { showSuccess, showError } = useToast();
  
  const containerPadding = { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 };

  useEffect(() => {
    if (project?.name) {
      setEditedTitle(project.name);
    }
  }, [project?.name]);

  useEffect(() => {
    if (project?.description !== undefined) {
      setEditedDescription(project.description || '');
    }
  }, [project?.description]);

  const handleStartEdit = () => {
    setEditedTitle(project?.name || '');
    setIsEditingTitle(true);
  };

  const handleCancelEdit = () => {
    setEditedTitle(project?.name || '');
    setIsEditingTitle(false);
  };

  const handleSaveTitle = async () => {
    if (!project) return;
    const trimmedTitle = editedTitle.trim();
    if (!trimmedTitle || trimmedTitle === project.name) { setIsEditingTitle(false); return; }
    setIsSavingTitle(true);
    try {
      await castingService.saveProject({ ...project, name: trimmedTitle });
      if (onUpdate) onUpdate();
      showSuccess('Tittel lagret');
    } catch (error) {
      console.error('Failed to save title:', error);
      showError('Kunne ikke lagre tittel. Prøv igjen.');
    } finally {
      setIsSavingTitle(false);
      setIsEditingTitle(false);
    }
  };

  const handleStartEditDescription = () => {
    setEditedDescription(project?.description || '');
    setIsEditingDescription(true);
  };

  const handleCancelEditDescription = () => {
    setEditedDescription(project?.description || '');
    setIsEditingDescription(false);
  };

  const handleSaveDescription = async () => {
    if (!project) return;
    const trimmedDescription = editedDescription.trim();
    if (trimmedDescription === (project.description || '')) { setIsEditingDescription(false); return; }
    setIsSavingDescription(true);
    try {
      await castingService.saveProject({ ...project, description: trimmedDescription || undefined });
      if (onUpdate) onUpdate();
      showSuccess('Beskrivelse lagret');
    } catch (error) {
      console.error('Failed to save description:', error);
      showError('Kunne ikke lagre beskrivelse. Prøv igjen.');
    } finally {
      setIsSavingDescription(false);
      setIsEditingDescription(false);
    }
  };

  // Statistics — single-pass loops, no redundant .filter() calls
  const stats = useMemo(() => {
    let openRoles = 0, filledRoles = 0;
    for (const r of roles) {
      if (r.status === 'open' || r.status === 'casting') openRoles++;
      else if (r.status === 'filled') filledRoles++;
    }
    let confirmedCandidates = 0, selectedCandidates = 0, shortlistCandidates = 0;
    for (const c of candidates) {
      if (c.status === 'confirmed') confirmedCandidates++;
      else if (c.status === 'selected') selectedCandidates++;
      else if (c.status === 'shortlist') shortlistCandidates++;
    }
    // Compare ISO date strings (YYYY-MM-DD) lexicographically — avoids timezone edge cases
    const todayStr = new Date().toISOString().slice(0, 10);
    let upcomingSchedules = 0;
    for (const s of schedules) {
      if (s.date >= todayStr) upcomingSchedules++;
    }
    return {
      totalRoles: roles.length,
      openRoles,
      filledRoles,
      totalCandidates: candidates.length,
      confirmedCandidates,
      selectedCandidates,
      shortlistCandidates,
      upcomingSchedules,
      castingProgress: roles.length > 0 ? Math.round((filledRoles / roles.length) * 100) : 0,
    };
  }, [roles, candidates, schedules]);

  // Status distribution for progress bar — single reduce pass
  const statusDistribution = useMemo(() => {
    if (candidates.length === 0) return [];
    const counts = candidates.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {});
    return [
      { status: 'confirmed', color: '#10b981', label: 'Bekreftet' },
      { status: 'selected', color: '#8b5cf6', label: 'Valgt' },
      { status: 'shortlist', color: '#ffb800', label: 'Shortlist' },
      { status: 'requested', color: '#00d4ff', label: 'Forespurt' },
      { status: 'pending', color: '#6b7280', label: 'Venter' },
      { status: 'rejected', color: '#ef4444', label: 'Avvist' },
    ].map(s => ({ ...s, count: counts[s.status] || 0 }))
     .filter(s => s.count > 0);
  }, [candidates]);

  const statCards = [
    { title: 'Roller totalt', value: stats.totalRoles, color: '#f48fb1', icon: RolesIcon, tabIndex: 2 },
    { title: 'Åpne roller', value: stats.openRoles, color: '#10b981', icon: RolesIcon, tabIndex: 2 },
    { title: 'Kandidater', value: stats.totalCandidates, color: '#10b981', icon: CandidatesIcon, tabIndex: 3 },
    { title: 'Kommende avtaler', value: stats.upcomingSchedules, color: '#ffb800', icon: AuditionsIcon, tabIndex: 4 },
  ];

  const _quickLinks = [
    { title: 'Team', description: 'Administrer crew', color: '#00d4ff', icon: TeamIcon, tabIndex: 7 },
    { title: 'Lokasjoner', description: 'Lokasjoner', color: '#4caf50', icon: LocationIcon, tabIndex: 5 },
    { title: 'Utstyr', description: 'Rekvisitter', color: '#9333ea', icon: PropsIcon, tabIndex: 8 },
    { title: 'Kamera', description: 'Shot lists', color: '#e91e63', icon: ShotListIcon, tabIndex: 9 },
    { title: 'Kalender', description: 'Produksjonsplan', color: '#9c27b0', icon: CalendarIcon, tabIndex: 6 },
  ];

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ p: containerPadding, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
    >
      {/* Header with Icon and Title */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, flexWrap: 'wrap', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
          <Box
            sx={{
              width: { xs: 48, sm: 56, md: 52, lg: 60, xl: 68 },
              height: { xs: 48, sm: 56, md: 52, lg: 60, xl: 68 },
              borderRadius: 2,
              bgcolor: 'rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DashboardIcon sx={{ fontSize: { xs: 24, sm: 28, md: 26, lg: 30, xl: 36 }, color: '#8b5cf6' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {isEditingTitle ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <TextField
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveTitle();
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                  autoFocus
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.4rem', lg: '1.6rem', xl: '2rem' },
                      fontWeight: 700,
                      '& fieldset': {
                        borderColor: 'rgba(255,255,255,0.3)',
                        borderWidth: 2,
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255,255,255,0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#00d4ff',
                        borderWidth: 2,
                      },
                    },
                  }}
                />
                <IconButton
                  onClick={handleSaveTitle}
                  size="small"
                  disabled={isSavingTitle}
                  sx={{
                    color: '#00d4ff',
                    minWidth: TOUCH_TARGET_SIZE,
                    minHeight: TOUCH_TARGET_SIZE,
                    '&:hover': { bgcolor: 'rgba(0,212,255,0.1)' },
                    ...focusVisibleStyles,
                  }}
                  aria-label="Lagre tittel"
                >
                  {isSavingTitle ? <CircularProgress size={20} sx={{ color: '#00d4ff' }} /> : <SaveIcon />}
                </IconButton>
                <IconButton
                  onClick={handleCancelEdit}
                  size="small"
                  sx={{
                    color: 'rgba(255,255,255,0.87)',
                    minWidth: TOUCH_TARGET_SIZE,
                    minHeight: TOUCH_TARGET_SIZE,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    ...focusVisibleStyles,
                  }}
                  aria-label="Avbryt"
                >
                  <CancelIcon />
                </IconButton>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography
                  variant="h5"
                  component="h2"
                  id={titleId}
                  sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.4rem', lg: '1.6rem', xl: '2rem' }, flex: 1 }}
                >
                  {project?.name || 'Prosjektoversikt'}
                </Typography>
                {project && (
                  <Tooltip title="Rediger tittel">
                    <IconButton
                      onClick={handleStartEdit}
                      size="small"
                      sx={{
                        color: 'rgba(255,255,255,0.87)',
                        minWidth: TOUCH_TARGET_SIZE,
                        minHeight: TOUCH_TARGET_SIZE,
                        '&:hover': { 
                          color: '#00d4ff',
                          bgcolor: 'rgba(0,212,255,0.1)' 
                        },
                        ...focusVisibleStyles,
                      }}
                      aria-label="Rediger prosjektnavn"
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            )}
            {isEditingDescription ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <TextField
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveDescription();
                    } else if (e.key === 'Escape') {
                      handleCancelEditDescription();
                    }
                  }}
                  autoFocus
                  multiline
                  maxRows={3}
                  placeholder="Beskrivelse (valgfri)"
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      color: 'rgba(255,255,255,0.87)',
                      fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.9rem', xl: '1rem' },
                      '& fieldset': {
                        borderColor: 'rgba(255,255,255,0.2)',
                        borderWidth: 1,
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255,255,255,0.3)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#00d4ff',
                        borderWidth: 1,
                      },
                    },
                  }}
                />
                <IconButton
                  onClick={handleSaveDescription}
                  size="small"
                  disabled={isSavingDescription}
                  sx={{
                    color: '#00d4ff',
                    minWidth: TOUCH_TARGET_SIZE,
                    minHeight: TOUCH_TARGET_SIZE,
                    '&:hover': { bgcolor: 'rgba(0,212,255,0.1)' },
                    ...focusVisibleStyles,
                  }}
                  aria-label="Lagre beskrivelse"
                >
                  {isSavingDescription ? <CircularProgress size={20} sx={{ color: '#00d4ff' }} /> : <SaveIcon />}
                </IconButton>
                <IconButton
                  onClick={handleCancelEditDescription}
                  size="small"
                  sx={{
                    color: 'rgba(255,255,255,0.87)',
                    minWidth: TOUCH_TARGET_SIZE,
                    minHeight: TOUCH_TARGET_SIZE,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    ...focusVisibleStyles,
                  }}
                  aria-label="Avbryt"
                >
                  <CancelIcon />
                </IconButton>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', flex: 1, fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.85rem', lg: '0.9rem', xl: '1rem' } }}>
                  {project?.description || 'Oversikt over casting og produksjon'}
                </Typography>
                {project && (
                  <Tooltip title="Rediger beskrivelse">
                    <IconButton
                      onClick={handleStartEditDescription}
                      size="small"
                      sx={{
                        color: 'rgba(255,255,255,0.7)',
                        minWidth: TOUCH_TARGET_SIZE,
                        minHeight: TOUCH_TARGET_SIZE,
                        '&:hover': { 
                          color: '#00d4ff',
                          bgcolor: 'rgba(0,212,255,0.1)' 
                        },
                        ...focusVisibleStyles,
                      }}
                      aria-label="Rediger beskrivelse"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Tooltip title="Åpne Dashboard-guide">
          <IconButton
            onClick={() => setGuideOpen(true)}
            size="small"
            sx={{
              color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 1.5,
              p: 0.75,
              minWidth: TOUCH_TARGET_SIZE,
              minHeight: TOUCH_TARGET_SIZE,
              '&:hover': { color: '#8b5cf6', borderColor: '#8b5cf6', bgcolor: 'rgba(139,92,246,0.1)' },
              ...focusVisibleStyles,
            }}
            aria-label="Åpne guide"
          >
            <HelpIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Del prosjekt med teamet">
          <Button
            variant="outlined"
            startIcon={<ShareIcon />}
            onClick={onOpenSharing}
            sx={{
              borderColor: 'rgba(255,255,255,0.2)',
              color: '#fff',
              fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
              minHeight: TOUCH_TARGET_SIZE,
              px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
              py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
              '&:hover': { borderColor: '#8b5cf6', bgcolor: 'rgba(139,92,246,0.1)' },
              ...focusVisibleStyles,
            }}
          >
            {!isMobile && 'Del prosjekt'}
          </Button>
        </Tooltip>
        </Box>
      </Box>

      <DashboardGuide open={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* Statistics Cards */}
      <Grid container spacing={{ xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }} sx={{ mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 } }}>
        {statCards.map((card) => (
          <Grid item key={card.title} xs={6} sm={6} md={3}>
            <Card
              component="button"
              onClick={() => onNavigateToTab(card.tabIndex)}
              sx={{
                width: '100%',
                bgcolor: `${card.color}08`,
                border: `1px solid ${card.color}33`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 8px 24px ${card.color}33` },
                ...focusVisibleStyles,
              }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                <Box
                  sx={{
                    width: { xs: 44, sm: 56, md: 52, lg: 60, xl: 68 },
                    height: { xs: 44, sm: 56, md: 52, lg: 60, xl: 68 },
                    borderRadius: 2,
                    bgcolor: `${card.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <card.icon sx={{ fontSize: { xs: 22, sm: 28, md: 26, lg: 30, xl: 36 }, color: card.color }} />
                </Box>
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="h4" sx={{ color: card.color, fontWeight: 700, lineHeight: 1, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
                    {card.value}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.875rem', md: '0.85rem', lg: '0.9rem', xl: '1rem' } }}>
                    {card.title}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Casting Progress Card */}
      {candidates.length > 0 && (
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 } }}>
          <CardContent sx={{ p: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 3.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 }, mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
              <TrendingUpIcon sx={{ color: '#8b5cf6', fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 32 } }} />
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.05rem', lg: '1.15rem', xl: '1.25rem' } }}>
                Casting-fremdrift
              </Typography>
              {stats.castingProgress > 0 && (
                <Chip
                  label={`${stats.castingProgress}% fullført`}
                  size="small"
                  sx={{ 
                    bgcolor: 'rgba(139,92,246,0.2)', 
                    color: '#8b5cf6', 
                    ml: 'auto',
                    height: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 },
                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                  }}
                />
              )}
            </Box>
            
            {/* Progress bar */}
            <Box sx={{ display: 'flex', gap: 0.5, height: { xs: 10, sm: 12, md: 11, lg: 13, xl: 16 }, borderRadius: { xs: 5, sm: 6, md: 5.5, lg: 6.5, xl: 8 }, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.1)', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
              {statusDistribution.map(({ status, color, count }) => {
                const percentage = (count / candidates.length) * 100;
                return (
                  <Tooltip key={status} title={`${count} kandidater`}>
                    <Box sx={{ width: `${percentage}%`, bgcolor: color, transition: 'width 0.3s ease', minWidth: percentage > 0 ? 4 : 0 }} />
                  </Tooltip>
                );
              })}
            </Box>
            
            {/* Status legend */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
              {statusDistribution.map(({ status, color, label, count }) => (
                <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                  <Box sx={{ width: { xs: 10, sm: 12, md: 11, lg: 13, xl: 16 }, height: { xs: 10, sm: 12, md: 11, lg: 13, xl: 16 }, borderRadius: '50%', bgcolor: color }} />
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.85rem', lg: '0.9rem', xl: '1rem' } }}>
                    {label}: <strong style={{ color: '#fff' }}>{count}</strong>
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 3.5 } }}>
          <Typography variant="h6" sx={{ color: '#fff', mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, fontWeight: 600, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.05rem', lg: '1.15rem', xl: '1.25rem' } }}>
            Hurtighandlinger
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
            <Tooltip title="Opprett ny rolle" arrow>
              <Button
                variant="contained"
                startIcon={<AddIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                onClick={(e) => {                  e.stopPropagation();                  onCreateRole();                }}
                sx={{
                  bgcolor: '#00d4ff',
                  color: '#000',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  fontWeight: 600,
                  minHeight: TOUCH_TARGET_SIZE,
                  px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                  py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                  '&:hover': { bgcolor: '#00b8e6' },
                  ...focusVisibleStyles,
                }}
              >
                {isMobile ? 'Rolle' : 'Ny rolle'}
              </Button>
            </Tooltip>
            <Tooltip title="Legg til kandidat" arrow>
              <Button
                variant="contained"
                startIcon={<CandidatesIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateCandidate();
                }}
                sx={{
                  bgcolor: '#10b981',
                  color: '#fff',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  fontWeight: 600,
                  minHeight: TOUCH_TARGET_SIZE,
                  px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                  py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                  '&:hover': { bgcolor: '#059669' },
                  ...focusVisibleStyles,
                }}
              >
                {isMobile ? 'Kandidat' : 'Ny kandidat'}
              </Button>
            </Tooltip>
            <Tooltip title="Planlegg audition" arrow>
              {(() => {
                const isDisabled = candidates.length === 0 || roles.length === 0;
                const button = (
                  <Button
                    variant="contained"
                    startIcon={<CalendarIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateSchedule();
                    }}
                    disabled={isDisabled}
                    sx={{
                      bgcolor: '#8b5cf6',
                      color: '#fff',
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      fontWeight: 600,
                      minHeight: TOUCH_TARGET_SIZE,
                      px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                      py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                      '&:hover': { bgcolor: '#7c3aed' },
                      '&:disabled': { bgcolor: 'rgba(139,92,246,0.3)' },
                      ...focusVisibleStyles,
                    }}
                  >
                    {isMobile ? 'Timeplan' : 'Ny timeplan'}
                  </Button>
                );
                return isDisabled ? <span style={{ display: 'inline-block' }}>{button}</span> : button;
              })()}
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(132,204,22,0.2)', mt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
        <CardContent sx={{ p: 0 }}>
          <Suspense fallback={<CircularProgress sx={{ color: '#84cc16', display: 'block', mx: 'auto', my: 4 }} />}>
            <KanbanPanelLazy
              project={project}
              candidates={candidates}
              roles={roles}
              onCandidatesChange={onCandidatesChange || (() => {})}
              onEditCandidate={onEditCandidate || (() => {})}
              onCreateCandidate={onCreateCandidate}
              onNavigateToTab={onNavigateToTab}
            />
          </Suspense>
        </CardContent>
      </Card>
    </Box>
  );
}

export const DashboardPanel = memo(DashboardPanelInner);
