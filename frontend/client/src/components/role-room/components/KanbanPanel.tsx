import { useState, useId, useMemo, useEffect, type DragEvent, memo } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Tooltip,
  Collapse,
  IconButton,
  TextField,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  Person as PersonIcon,
  ViewKanban as ViewKanbanIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { StatsIcon, CandidatesIcon } from './icons/CastingIcons';
import { Candidate, Role, CastingProject } from '../models/casting';
import { castingService } from '../services/castingService';

// WCAG 2.2 - 2.5.5 Target Size: minimum 44x44px touch targets
const TOUCH_TARGET_SIZE = 44;

// WCAG 2.2 - 2.4.7 Focus Visible: clear focus indicator
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #84cc16',
    outlineOffset: 2,
  },
};

interface KanbanPanelProps {
  project: CastingProject | null;
  candidates: Candidate[];
  roles: Role[];
  onCandidatesChange: () => void;
  onEditCandidate: (candidate: Candidate) => void;
  onCreateCandidate: () => void;
  onNavigateToTab: (tabIndex: number) => void;
}

type CandidateStatus = 'pending' | 'requested' | 'shortlist' | 'selected' | 'confirmed' | 'rejected';

interface KanbanColumn {
  status: CandidateStatus;
  label: string;
  color: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { status: 'pending', label: 'Venter', color: '#6b7280' },
  { status: 'requested', label: 'Forespurt', color: '#00d4ff' },
  { status: 'shortlist', label: 'Shortlist', color: '#ffb800' },
  { status: 'selected', label: 'Valgt', color: '#8b5cf6' },
  { status: 'confirmed', label: 'Bekreftet', color: '#10b981' },
  { status: 'rejected', label: 'Avvist', color: '#ef4444' },
];

function KanbanPanelInner({
  project,
  candidates,
  roles,
  onCandidatesChange,
  onEditCandidate,
  onCreateCandidate,
  onNavigateToTab,
}: KanbanPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const titleId = useId();
  const statsId = useId();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [draggedCandidate, setDraggedCandidate] = useState<Candidate | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  
  const containerPadding = { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 };

  // Keyboard shortcuts (scoped: skip when typing in inputs)
  // Uses Ctrl+Shift+N to avoid conflict with browser's Ctrl+N (new tab/window)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === 'N') { e.preventDefault(); onCreateCandidate(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCreateCandidate]);

  // Filter candidates by search
  const filteredCandidates = useMemo(() => {
    if (!searchQuery) return candidates;
    const q = searchQuery.toLowerCase();
    return candidates.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.contactInfo.email?.toLowerCase().includes(q) ||
      c.auditionNotes?.toLowerCase().includes(q)
    );
  }, [candidates, searchQuery]);

  // Statistics
  const statistics = useMemo(() => {
    const stats: Record<CandidateStatus, number> = {
      pending: 0, requested: 0, shortlist: 0, selected: 0, confirmed: 0, rejected: 0
    };
    candidates.forEach(c => { if (stats[c.status] !== undefined) stats[c.status]++; });
    return stats;
  }, [candidates]);

  const progressPercentage = useMemo(() => {
    if (candidates.length === 0) return 0;
    return Math.round((statistics.confirmed / candidates.length) * 100);
  }, [candidates, statistics]);

  // Handlers
  const toggleColumnCollapse = (status: string) => {
    setCollapsedColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) newSet.delete(status);
      else newSet.add(status);
      return newSet;
    });
  };

  const handleDrop = async (targetStatus: CandidateStatus) => {
    if (draggedCandidate && project && draggedCandidate.status !== targetStatus) {
      const updated = {
        ...draggedCandidate,
        status: targetStatus,
        updatedAt: new Date().toISOString()
      };
      setDraggedCandidate(null);
      try {
        await castingService.saveCandidate(project.id, updated);
        onCandidatesChange();
      } catch (error) {
        console.error('Failed to save candidate status:', error);
        // Revert UI by triggering refresh
        onCandidatesChange();
      }
    }
  };

  const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Ukjent';

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
              bgcolor: 'rgba(132, 204, 22, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ViewKanbanIcon sx={{ fontSize: { xs: 24, sm: 28, md: 26, lg: 30, xl: 36 }, color: '#84cc16' }} />
          </Box>
          <Box>
            <Typography
              variant="h5"
              id={titleId}
              sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.4rem', lg: '1.6rem', xl: '2rem' } }}
            >
              Kanban-tavle
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.85rem', lg: '0.9rem', xl: '1rem' } }}>
              Dra og slipp kandidater mellom kolonner
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 }, flexWrap: 'wrap' }}>
          <Tooltip title="Vis statistikk">
            <Button
              variant={showStats ? 'contained' : 'outlined'}
              startIcon={<StatsIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              onClick={() => setShowStats(!showStats)}
              sx={{
                borderColor: 'rgba(255,255,255,0.2)',
                color: showStats ? '#000' : '#fff',
                bgcolor: showStats ? '#84cc16' : 'transparent',
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                ...focusVisibleStyles,
              }}
            >
              {!isMobile && 'Statistikk'}
            </Button>
          </Tooltip>
          <Tooltip title="Ny kandidat (Ctrl+Shift+N)">
            <Button
              variant="contained"
              startIcon={<AddIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              onClick={onCreateCandidate}
              sx={{
                bgcolor: '#8b5cf6',
                color: '#fff',
                fontWeight: 600,
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                '&:hover': { bgcolor: '#7c3aed' },
                ...focusVisibleStyles,
              }}
            >
              {isMobile ? '' : 'Ny kandidat'}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Statistics Panel */}
      <Collapse in={showStats}>
        <Box
          id={statsId}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(6, 1fr)' },
            gap: { xs: 1, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            bgcolor: 'rgba(132, 204, 22, 0.05)',
            borderRadius: 2,
            border: '1px solid rgba(132, 204, 22, 0.2)',
          }}
        >
          {KANBAN_COLUMNS.map(col => (
            <Box key={col.status} sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                <CandidatesIcon sx={{ fontSize: { xs: 14, sm: 16, md: 15, lg: 17, xl: 20 }, color: col.color }} />
              </Box>
              <Typography variant="h4" sx={{ color: col.color, fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
                {statistics[col.status]}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.7rem', lg: '0.72rem', xl: '0.875rem' } }}>
                {col.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>

      {/* Search */}
      <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, alignItems: 'center' }}>
        <TextField
          placeholder={isMobile ? 'Søk...' : 'Søk på navn, e-post...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)', mr: 1, fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />,
              sx: { minHeight: TOUCH_TARGET_SIZE },
            },
            htmlInput: { 'aria-label': 'Søk i kandidater' },
          }}
          sx={{
            flex: 1,
            maxWidth: { xs: '100%', sm: 400, md: 380, lg: 420, xl: 480 },
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
              height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
              '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
            },
          }}
        />
        {searchQuery && (
          <Tooltip title="Nullstill søk">
            <IconButton onClick={() => setSearchQuery('')} sx={{ color: 'rgba(255,255,255,0.87)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
              <ClearIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Progress Bar */}
      {candidates.length > 0 && (
        <Box sx={{ mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 }, flexWrap: 'wrap', gap: { xs: 0.5, sm: 1 } }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' } }}>
              Casting-fremdrift
            </Typography>
            <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' } }}>
              {statistics.confirmed} av {candidates.length} bekreftet ({progressPercentage}%)
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, height: { xs: 8, sm: 10, md: 9, lg: 11, xl: 14 }, borderRadius: { xs: 4, sm: 5, md: 4.5, lg: 5.5, xl: 7 }, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.1)' }}>
            {KANBAN_COLUMNS.map(col => {
              const count = statistics[col.status];
              const percentage = candidates.length > 0 ? (count / candidates.length) * 100 : 0;
              return percentage > 0 ? (
                <Tooltip key={col.status} title={`${col.label}: ${count}`}>
                  <Box sx={{ width: `${percentage}%`, bgcolor: col.color, transition: 'width 0.3s ease', minWidth: 4 }} />
                </Tooltip>
              ) : null;
            })}
          </Box>
        </Box>
      )}

      {/* Empty State */}
      {candidates.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 4,
            bgcolor: 'rgba(132, 204, 22, 0.03)',
            borderRadius: 3,
            border: '2px dashed rgba(132, 204, 22, 0.2)',
          }}
        >
          <Box
            sx={{
              width: { xs: 64, sm: 80, md: 72, lg: 88, xl: 104 },
              height: { xs: 64, sm: 80, md: 72, lg: 88, xl: 104 },
              borderRadius: '50%',
              bgcolor: 'rgba(132, 204, 22, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              mb: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 3.5 },
            }}
          >
            <ViewKanbanIcon sx={{ fontSize: { xs: 32, sm: 40, md: 36, lg: 44, xl: 52 }, color: '#84cc16' }} />
          </Box>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600, mb: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 }, fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.15rem', lg: '1.35rem', xl: '1.5rem' } }}>
            Organiser kandidatene dine
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.87)', mb: { xs: 3, sm: 4, md: 3.5, lg: 4, xl: 4.5 }, maxWidth: { xs: '100%', sm: 450, md: 420, lg: 480, xl: 540 }, mx: 'auto', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
            Kanban-tavlen lar deg visuelt spore kandidater gjennom casting-prosessen ved å dra og slippe mellom kolonner.
          </Typography>
          <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              onClick={onCreateCandidate}
              sx={{
                bgcolor: '#84cc16',
                color: '#000',
                fontWeight: 600,
                px: { xs: 3, sm: 4, md: 3.5, lg: 4, xl: 5 },
                py: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.5, xl: 1.75 },
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                '&:hover': { bgcolor: '#65a30d', transform: 'translateY(-2px)' },
                ...focusVisibleStyles,
              }}
            >
              Legg til første kandidat
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => onNavigateToTab(2)}
              sx={{
                borderColor: 'rgba(255,255,255,0.3)',
                color: '#fff',
                fontWeight: 600,
                px: { xs: 3, sm: 4, md: 3.5, lg: 4, xl: 5 },
                py: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.5, xl: 1.75 },
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                '&:hover': { borderColor: '#84cc16', bgcolor: 'rgba(132,204,22,0.1)' },
                ...focusVisibleStyles,
              }}
            >
              Gå til kandidatliste
            </Button>
          </Box>
        </Box>
      ) : (
        /* Kanban Board */
        <Box
          sx={{
            display: 'flex',
            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            overflowX: 'auto',
            pb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            '&::-webkit-scrollbar': { height: { xs: 6, sm: 8, md: 7, lg: 8, xl: 10 } },
            '&::-webkit-scrollbar-track': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: { xs: 3, sm: 4, md: 3.5, lg: 4, xl: 5 } },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: { xs: 3, sm: 4, md: 3.5, lg: 4, xl: 5 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.6)' } },
          }}
        >
          {KANBAN_COLUMNS.map((column) => {
            const columnCandidates = filteredCandidates.filter(c => c.status === column.status);
            const isCollapsed = collapsedColumns.has(column.status);
            const isDropTarget = draggedCandidate && draggedCandidate.status !== column.status;

            return (
              <Box
                key={column.status}
                sx={{
                  minWidth: isCollapsed ? { xs: 50, sm: 60, md: 55, lg: 65, xl: 75 } : { xs: 240, sm: 280, md: 260, lg: 300, xl: 360 },
                  maxWidth: isCollapsed ? { xs: 50, sm: 60, md: 55, lg: 65, xl: 75 } : { xs: 280, sm: 320, md: 300, lg: 360, xl: 420 },
                  flex: isCollapsed ? 'none' : 1,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  borderRadius: 2,
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderTop: `3px solid ${column.color}`,
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: 'calc(100vh - 380px)',
                  transition: 'all 0.2s ease',
                  ...(isDropTarget && { boxShadow: `0 0 0 2px ${column.color}40` }),
                }}
              >
                {/* Column Header */}
                <Box
                  sx={{
                    p: isCollapsed ? { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } : { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    bgcolor: `${column.color}08`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexDirection: isCollapsed ? 'column' : 'row',
                    gap: isCollapsed ? { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } : 0,
                  }}
                >
                  {!isCollapsed && (
                    <Typography variant="h6" sx={{ color: '#fff', fontSize: { xs: '13px', sm: '15px', md: '14px', lg: '16px', xl: '18px' }, fontWeight: 600 }}>
                      {column.label}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, flexDirection: isCollapsed ? 'column' : 'row' }}>
                    <Chip
                      label={columnCandidates.length}
                      size="small"
                      sx={{
                        bgcolor: `${column.color}30`,
                        color: column.color,
                        fontWeight: 700,
                        fontSize: { xs: '11px', sm: '13px', md: '12px', lg: '14px', xl: '16px' },
                        minWidth: { xs: 24, sm: 28, md: 26, lg: 32, xl: 36 },
                        height: { xs: 24, sm: 28, md: 26, lg: 32, xl: 36 },
                      }}
                    />
                    <Tooltip title={isCollapsed ? 'Utvid kolonne' : 'Skjul kolonne'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleColumnCollapse(column.status)}
                        sx={{ color: 'rgba(255,255,255,0.87)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                      >
                        {isCollapsed ? <ExpandIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <CollapseIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {isCollapsed && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: column.color,
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                        fontWeight: 600,
                        fontSize: { xs: '10px', sm: '11px', md: '10.5px', lg: '12px', xl: '14px' },
                      }}
                    >
                      {column.label}
                    </Typography>
                  )}
                </Box>

                {/* Column Content */}
                {!isCollapsed && (
                  <Box
                    sx={{
                      flex: 1,
                      overflowY: 'auto',
                      p: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.75, xl: 2 },
                      display: 'flex',
                      flexDirection: 'column',
                      gap: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.75, xl: 2 },
                      minHeight: { xs: 180, sm: 200, md: 190, lg: 220, xl: 260 },
                      transition: 'all 0.2s',
                      borderRadius: 1,
                      '&::-webkit-scrollbar': { width: { xs: 5, sm: 6, md: 5.5, lg: 7, xl: 8 } },
                      '&::-webkit-scrollbar-track': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: { xs: 2.5, sm: 3, md: 2.75, lg: 3.5, xl: 4 } },
                      '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: { xs: 2.5, sm: 3, md: 2.75, lg: 3.5, xl: 4 } },
                    }}
                    onDragOver={(e: DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (draggedCandidate && draggedCandidate.status !== column.status) {
                        const target = e.currentTarget as HTMLElement;
                        target.style.backgroundColor = `${column.color}15`;
                        target.style.outline = `2px dashed ${column.color}`;
                        target.style.outlineOffset = '-2px';
                      }
                    }}
                    onDragLeave={(e: DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      const target = e.currentTarget as HTMLElement;
                      target.style.backgroundColor = 'transparent';
                      target.style.outline = 'none';
                    }}
                    onDrop={(e: DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const target = e.currentTarget as HTMLElement;
                      target.style.backgroundColor = 'transparent';
                      target.style.outline = 'none';
                      handleDrop(column.status);
                    }}
                  >
                    {columnCandidates.map((candidate) => (
                      <Card
                        key={candidate.id}
                        draggable
                        onDragStart={(e: DragEvent<HTMLDivElement>) => {
                          setDraggedCandidate(candidate);
                          if (e.dataTransfer) {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', candidate.id);
                          }
                          (e.currentTarget as HTMLElement).style.opacity = '0.6';
                          (e.currentTarget as HTMLElement).style.transform = 'scale(1.02) rotate(2deg)';
                        }}
                        onDragEnd={(e: DragEvent<HTMLDivElement>) => {
                          setDraggedCandidate(null);
                          const target = e.currentTarget as HTMLElement;
                          target.style.opacity = '1';
                          target.style.transform = 'none';
                        }}
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') onEditCandidate(candidate); }}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderLeft: `3px solid ${column.color}`,
                          cursor: 'grab',
                          '&:active': { cursor: 'grabbing' },
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.1)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                          },
                          transition: 'all 0.15s ease',
                          touchAction: 'none',
                          userSelect: 'none',
                          ...focusVisibleStyles,
                        }}
                        onClick={() => { if (!draggedCandidate) onEditCandidate(candidate); }}
                      >
                        <CardContent sx={{ p: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.75, xl: 2 }, '&:last-child': { pb: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.75, xl: 2 } } }}>
                          <Box sx={{ display: 'flex', gap: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.75, xl: 2 }, alignItems: 'flex-start' }}>
                            {(candidate.photos?.length ?? 0) > 0 ? (
                              <Box
                                component="img"
                                src={candidate.photos[0]}
                                alt={candidate.name}
                                sx={{
                                  width: { xs: 44, sm: 48, md: 46, lg: 52, xl: 60 },
                                  height: { xs: 44, sm: 48, md: 46, lg: 52, xl: 60 },
                                  objectFit: 'cover',
                                  borderRadius: '50%',
                                  flexShrink: 0,
                                  border: `2px solid ${column.color}40`,
                                }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  width: { xs: 44, sm: 48, md: 46, lg: 52, xl: 60 },
                                  height: { xs: 44, sm: 48, md: 46, lg: 52, xl: 60 },
                                  borderRadius: '50%',
                                  bgcolor: `${column.color}20`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <PersonIcon sx={{ color: column.color, fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 32 } }} />
                              </Box>
                            )}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                variant="subtitle2"
                                sx={{
                                  color: '#fff',
                                  fontWeight: 600,
                                  mb: 0.25,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.9rem', xl: '1rem' },
                                }}
                              >
                                {candidate.name}
                              </Typography>
                              {candidate.contactInfo.email && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'rgba(255,255,255,0.87)',
                                    display: 'block',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontSize: { xs: '10px', sm: '11px', md: '10.5px', lg: '12px', xl: '14px' },
                                  }}
                                >
                                  {candidate.contactInfo.email}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          {(candidate.assignedRoles?.length ?? 0) > 0 && (
                            <Box sx={{ mt: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 }, display: 'flex', flexWrap: 'wrap', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                              {(candidate.assignedRoles || []).slice(0, 2).map((roleId) => (
                                <Chip
                                  key={roleId}
                                  label={getRoleName(roleId)}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(0,212,255,0.15)',
                                    color: '#00d4ff',
                                    fontSize: { xs: '9px', sm: '10px', md: '9.5px', lg: '11px', xl: '13px' },
                                    height: { xs: 18, sm: 20, md: 19, lg: 22, xl: 26 },
                                    maxWidth: { xs: 90, sm: 100, md: 95, lg: 110, xl: 130 },
                                    '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                                  }}
                                />
                              ))}
                              {(candidate.assignedRoles?.length ?? 0) > 2 && (
                                <Chip
                                  label={`+${(candidate.assignedRoles?.length ?? 0) - 2}`}
                                  size="small"
                                  sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.87)', fontSize: { xs: '9px', sm: '10px', md: '9.5px', lg: '11px', xl: '13px' }, height: { xs: 18, sm: 20, md: 19, lg: 22, xl: 26 } }}
                                />
                              )}
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {columnCandidates.length === 0 && (
                      <Box
                        sx={{
                          textAlign: 'center',
                          py: { xs: 3, sm: 4, md: 3.5, lg: 4, xl: 5 },
                          px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                          color: 'rgba(255,255,255,0.25)',
                          border: `2px dashed ${column.color}30`,
                          borderRadius: 2,
                          bgcolor: `${column.color}05`,
                        }}
                      >
                        <Typography variant="body2" sx={{ fontSize: { xs: '11px', sm: '13px', md: '12px', lg: '14px', xl: '16px' } }}>
                          {draggedCandidate ? `Slipp her for "${column.label}"` : 'Ingen kandidater'}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export const KanbanPanel = memo(KanbanPanelInner);
