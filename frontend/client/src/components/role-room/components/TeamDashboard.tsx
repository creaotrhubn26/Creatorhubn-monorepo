import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Badge,
  LinearProgress,
  Divider,
  Stack,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tab,
  Tabs,
  AvatarGroup,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Collapse,
  useMediaQuery,
  useTheme,
  Drawer,
} from '@mui/material';
import {
  DndContext,
  closestCenter,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ViewKanban as KanbanIcon,
  TableChart as TableIcon,
  Timeline as TimelineIcon,
  Person as PersonIcon,
  Assignment as TaskIcon,
  Warning as WarningIcon,
  CheckCircle as CompleteIcon,
  Schedule as PendingIcon,
  PlayArrow as InProgressIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreIcon,
  Notifications as NotificationIcon,
  History as HistoryIcon,
  Group as TeamIcon,
  Flag as FlagIcon,
  Lock as LockIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  TableView as ExcelIcon,
  Description as CallSheetIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { CalendarCustomIcon as CalendarIcon } from './icons/CastingIcons';
import { ShotList, CastingShot, CrewMember, ShotStatus, ShotPriority, SceneBreakdown, ProductionDay } from '../models/casting';

// Lazy load CallSheetGenerator for performance
const CallSheetGenerator = React.lazy(() => import('./CallSheetGenerator'));

interface TeamDashboardProps {
  shotLists: ShotList[];
  crewMembers: CrewMember[];
  currentUserId?: string;
  projectId?: string;
  scenes?: SceneBreakdown[];
  productionDay?: ProductionDay;
  onShotUpdate?: (shotList: ShotList, shot: CastingShot) => Promise<void>;
  onActivityLog?: (action: string, details: object) => void;
}

type ViewMode = 'kanban' | 'table' | 'timeline' | 'calendar' | 'workload';

interface ActivityLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  targetType: 'shot' | 'shotlist' | 'comment';
  targetId: string;
  targetName: string;
  timestamp: string;
  details?: object;
}

const statusColumns: { id: ShotStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { id: 'not_started', label: 'Venter', color: '#9e9e9e', icon: <PendingIcon /> },
  { id: 'in_progress', label: 'Pågår', color: '#2196f3', icon: <InProgressIcon /> },
  { id: 'completed', label: 'Fullført', color: '#4caf50', icon: <CompleteIcon /> },
];

const priorityConfig: Record<ShotPriority, { label: string; color: string; bgColor: string }> = {
  critical: { label: 'Kritisk', color: '#f44336', bgColor: 'rgba(244,67,54,0.15)' },
  important: { label: 'Viktig', color: '#ff9800', bgColor: 'rgba(255,152,0,0.15)' },
  nice_to_have: { label: 'Bonus', color: '#4caf50', bgColor: 'rgba(76,175,80,0.15)' },
};

interface DroppableColumnProps {
  id: string;
  children: React.ReactNode;
}

interface DroppableColumnProps {
  id: string;
  children: React.ReactNode;
  isOver?: boolean;
  columnColor?: string;
}

const DroppableColumn: React.FC<DroppableColumnProps> = ({ id, children, isOver: isOverProp, columnColor }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isOverColumn = isOver || isOverProp;
  
  return (
    <Box
      ref={setNodeRef}
      sx={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        p: { xs: 1.5, sm: 1 },
        minHeight: { xs: 100, sm: 0 },
        maxHeight: { xs: 'none', sm: '100%' },
        bgcolor: isOverColumn ? 'rgba(0,212,255,0.15)' : 'transparent',
        border: isOverColumn ? '2px dashed rgba(0,212,255,0.5)' : '2px solid transparent',
        borderRadius: 1,
        transition: 'all 0.15s ease',
        position: 'relative',
        WebkitOverflowScrolling: 'touch',
        '&::before': isOverColumn ? {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'rgba(0,212,255,0.05)',
          borderRadius: 1,
          pointerEvents: 'none',
          animation: 'pulse 1.5s ease-in-out infinite',
          '@keyframes pulse': {
            '0%, 100%': {
              opacity: 0.5,
            },
            '50%': {
              opacity: 1,
            },
          },
        } : {},
        '& > * > *': isOverColumn ? {
          transform: 'scale(1.02)',
          transition: 'transform 0.2s ease',
          filter: 'brightness(1.1)',
        } : {
          transition: 'all 0.2s ease',
        },
        '& [data-sortable]': isOverColumn ? {
          bgcolor: 'rgba(0,212,255,0.08) !important',
          border: '1px solid rgba(0,212,255,0.3) !important',
          transform: 'scale(1.02)',
          transition: 'all 0.2s ease',
          boxShadow: '0 0 12px rgba(0,212,255,0.3)',
        } : {},
        '&::-webkit-scrollbar': {
          width: 8,
        },
        '&::-webkit-scrollbar-track': {
          bgcolor: 'rgba(255,255,255,0.05)',
          borderRadius: 4,
        },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: 'rgba(255,255,255,0.2)',
          borderRadius: 4,
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.6)',
          },
        },
      }}
    >
      {children}
    </Box>
  );
};

interface KanbanCardProps {
  shot: CastingShot;
  shotList: ShotList;
  crewMembers: CrewMember[];
  onUpdate: (updates: Partial<CastingShot>) => void;
  isInDropZone?: boolean;
}

const KanbanCard: React.FC<KanbanCardProps> = React.memo(({ shot, shotList, crewMembers, onUpdate, isInDropZone }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Memoize assignee lookup
  const assignee = useMemo(() => 
    crewMembers.find(m => m.id === shot.assigneeId),
    [crewMembers, shot.assigneeId]
  );
  const priority = priorityConfig[shot.priority || 'important'];

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-sortable
      sx={{
        mb: { xs: 1.5, sm: 1 },
        cursor: 'grab',
        bgcolor: '#1a1a2e',
        border: '1px solid rgba(255,255,255,0.1)',
        borderLeft: `4px solid ${priority.color}`,
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        '&:hover': {
          borderColor: 'rgba(255,255,255,0.3)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        },
        '&:active': { 
          cursor: 'grabbing',
          transform: 'scale(1.02)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        },
      }}
    >
      <CardContent sx={{ 
        p: { xs: 2, sm: 1.5 }, 
        '&:last-child': { pb: { xs: 2, sm: 1.5 } } 
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 1.5, sm: 1 } }}>
          <Typography variant="body2" sx={{ 
            color: '#fff', 
            fontWeight: 600, 
            flex: 1,
            fontSize: { xs: '0.9rem', sm: '0.875rem' },
            lineHeight: 1.4,
          }}>
            {shot.description || shot.shotType}
          </Typography>
          {shot.reservedBy && (
            <Tooltip title={`Reservert av ${shot.reservedByName}`}>
              <LockIcon sx={{ fontSize: { xs: 18, sm: 14 }, color: '#ff9800', ml: 1 }} />
            </Tooltip>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: { xs: 1, sm: 0.5 }, flexWrap: 'wrap', mb: { xs: 1.5, sm: 1 } }}>
          <Chip
            label={priority.label}
            size="small"
            sx={{
              height: { xs: 24, sm: 18 },
              fontSize: { xs: '11px', sm: '10px' },
              bgcolor: priority.bgColor,
              color: priority.color,
              border: `1px solid ${priority.color}33`,
              '& .MuiChip-label': { px: { xs: 1.5, sm: 1 } },
            }}
          />
          {shot.colorTag && (
            <Box
              sx={{
                width: { xs: 24, sm: 18 },
                height: { xs: 24, sm: 18 },
                borderRadius: '50%',
                bgcolor: {
                  red: '#f44336',
                  orange: '#ff9800',
                  yellow: '#ffeb3b',
                  green: '#4caf50',
                  blue: '#2196f3',
                  purple: '#9c27b0',
                  gray: '#9e9e9e',
                }[shot.colorTag],
              }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ 
            color: 'rgba(255,255,255,0.87)',
            fontSize: { xs: '0.8rem', sm: '0.75rem' },
          }}>
            {shotList.sceneName || 'Scene'}
          </Typography>
          {assignee ? (
            <Tooltip title={`Tilordnet: ${assignee.name}`}>
              <Avatar sx={{ 
                width: { xs: 32, sm: 24 }, 
                height: { xs: 32, sm: 24 }, 
                bgcolor: '#e91e63', 
                fontSize: { xs: 14, sm: 12 } 
              }}>
                {assignee.name.charAt(0)}
              </Avatar>
            </Tooltip>
          ) : (
            <Tooltip title="Ikke tilordnet">
              <Chip
                icon={<PersonIcon sx={{ fontSize: { xs: 16, sm: 14 }, color: '#ff9800 !important' }} />}
                label="Ledig"
                size="small"
                sx={{ 
                  height: { xs: 26, sm: 20 },
                  bgcolor: 'rgba(255,152,0,0.15)',
                  color: '#ff9800',
                  fontSize: { xs: '0.7rem', sm: '0.65rem' },
                  border: '1px dashed rgba(255,152,0,0.4)',
                  '& .MuiChip-label': { px: { xs: 0.75, sm: 0.5 } },
                }}
              />
            </Tooltip>
          )}
        </Box>

        {shot.estimatedTime && (
          <Typography variant="caption" sx={{ 
            color: 'rgba(255,255,255,0.7)', 
            display: 'block', 
            mt: { xs: 1, sm: 0.5 },
            fontSize: { xs: '0.8rem', sm: '0.75rem' },
          }}>
            {shot.estimatedTime} min
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memoization
  return (
    prevProps.shot.id === nextProps.shot.id &&
    prevProps.shot.status === nextProps.shot.status &&
    prevProps.shot.assigneeId === nextProps.shot.assigneeId &&
    prevProps.shot.priority === nextProps.shot.priority &&
    prevProps.shot.description === nextProps.shot.description &&
    prevProps.shotList.id === nextProps.shotList.id &&
    prevProps.crewMembers.length === nextProps.crewMembers.length
  );
});

export const TeamDashboard: React.FC<TeamDashboardProps> = ({
  shotLists,
  crewMembers,
  currentUserId,
  projectId,
  scenes = [],
  productionDay,
  onShotUpdate,
  onActivityLog,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [statsExpanded, setStatsExpanded] = useState(!isMobile && !isTablet);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedMemberForAssign, setSelectedMemberForAssign] = useState<string | null>(null);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [showCallSheetDrawer, setShowCallSheetDrawer] = useState(false);

  // Memoize handleShotUpdate to prevent unnecessary re-renders
  const handleShotUpdate = useCallback((shotList: ShotList, shot: CastingShot, updates: Partial<CastingShot>) => {
    if (onShotUpdate) {
      onShotUpdate(shotList, { ...shot, ...updates });
    }
  }, [onShotUpdate]);

  const exportToCSV = useCallback((shots: { shot: CastingShot; shotList: ShotList }[], members: CrewMember[]) => {
    const statusLabels: Record<string, string> = { not_started: 'Venter', in_progress: 'Pågår', completed: 'Fullført' };
    const priorityLabels: Record<string, string> = { critical: 'Kritisk', important: 'Viktig', nice_to_have: 'Bonus' };
    
    const headers = ['Beskrivelse', 'Scene', 'Status', 'Prioritet', 'Tilordnet', 'Estimert tid (min)'];
    const rows = shots.map(({ shot, shotList }) => {
      const assignee = members.find(m => m.id === shot.assigneeId);
      return [
        shot.description || shot.shotType,
        shotList.sceneName || 'Scene',
        statusLabels[shot.status || 'not_started'] || shot.status || 'not_started',
        priorityLabels[shot.priority || 'important'],
        assignee?.name || 'Ledig',
        shot.estimatedTime?.toString() || '',
      ];
    });
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shots-eksport-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportToPDF = useCallback(async (shots: { shot: CastingShot; shotList: ShotList }[], members: CrewMember[]) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const statusLabels: Record<string, string> = { not_started: 'Venter', in_progress: 'Pågår', completed: 'Fullført' };
    const priorityLabels: Record<string, string> = { critical: 'Kritisk', important: 'Viktig', nice_to_have: 'Bonus' };
    
    doc.setFontSize(18);
    doc.text('Shot Liste Eksport', 14, 20);
    doc.setFontSize(10);
    doc.text(`Eksportert: ${new Date().toLocaleDateString('nb-NO')}`, 14, 28);
    doc.text(`Antall shots: ${shots.length}`, 14, 34);
    
    let y = 45;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.height;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Beskrivelse', 14, y);
    doc.text('Scene', 80, y);
    doc.text('Status', 110, y);
    doc.text('Prioritet', 140, y);
    doc.text('Tilordnet', 170, y);
    y += lineHeight;
    doc.line(14, y - 2, 196, y - 2);
    
    doc.setFont('helvetica', 'normal');
    shots.forEach(({ shot, shotList }) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      const assignee = members.find(m => m.id === shot.assigneeId);
      doc.text((shot.description || shot.shotType).slice(0, 30), 14, y);
      doc.text((shotList.sceneName || 'Scene').slice(0, 15), 80, y);
      doc.text(statusLabels[shot.status || 'not_started'] || shot.status || 'not_started', 110, y);
      doc.text(priorityLabels[shot.priority || 'important'], 140, y);
      doc.text(assignee?.name.slice(0, 12) || 'Ledig', 170, y);
      y += lineHeight;
    });
    
    doc.save(`shots-eksport-${new Date().toISOString().split('T')[0]}.pdf`);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const allShots = useMemo(() => {
    let shots: { shot: CastingShot; shotList: ShotList }[] = [];
    
    // Flatten shots with their shotLists
    for (const sl of shotLists) {
      for (const shot of sl.shots) {
        shots.push({ shot, shotList: sl });
      }
    }

    // Apply filters
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      shots = shots.filter(({ shot }) =>
        shot.description?.toLowerCase().includes(query) ||
        shot.shotType.toLowerCase().includes(query)
      );
    }

    if (filterAssignee !== 'all') {
      shots = shots.filter(({ shot }) =>
        filterAssignee === 'unassigned' ? !shot.assigneeId : shot.assigneeId === filterAssignee
      );
    }

    if (filterPriority !== 'all') {
      shots = shots.filter(({ shot }) => shot.priority === filterPriority);
    }

    return shots;
  }, [shotLists, searchQuery, filterAssignee, filterPriority]);

  const shotsByStatus = useMemo(() => {
    const grouped: Record<ShotStatus, { shot: CastingShot; shotList: ShotList }[]> = {
      not_started: [],
      in_progress: [],
      completed: [],
    };
    // Use for loop for better performance
    for (let i = 0; i < allShots.length; i++) {
      const item = allShots[i];
      const status = item.shot.status || 'not_started';
      if (grouped[status]) {
        grouped[status].push(item);
      }
    }
    return grouped;
  }, [allShots]);

  const workloadByMember = useMemo(() => {
    const workload: Record<string, { assigned: number; completed: number; inProgress: number; totalTime: number }> = {};
    
    crewMembers.forEach(member => {
      workload[member.id] = { assigned: 0, completed: 0, inProgress: 0, totalTime: 0 };
    });
    workload['unassigned'] = { assigned: 0, completed: 0, inProgress: 0, totalTime: 0 };

    allShots.forEach(({ shot }) => {
      const memberId = shot.assigneeId || 'unassigned';
      if (!workload[memberId]) {
        workload[memberId] = { assigned: 0, completed: 0, inProgress: 0, totalTime: 0 };
      }
      workload[memberId].assigned++;
      workload[memberId].totalTime += shot.estimatedTime || 0;
      if (shot.status === 'completed') workload[memberId].completed++;
      if (shot.status === 'in_progress') workload[memberId].inProgress++;
    });

    return workload;
  }, [allShots, crewMembers]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const overId = over.id as string;
    const activeItem = allShots.find(({ shot }) => shot.id === active.id);
    
    if (!activeItem) return;

    // Check if dropped on a column directly
    let newStatus = statusColumns.find(col => col.id === overId)?.id;
    
    // If not dropped on a column, check if dropped on another shot and find its column
    if (!newStatus) {
      const overShot = allShots.find(({ shot }) => shot.id === overId);
      if (overShot) {
        newStatus = overShot.shot.status;
      }
    }
    
    if (newStatus && activeItem.shot.status !== newStatus) {
      const updatedShot = { ...activeItem.shot, status: newStatus, updatedAt: new Date().toISOString() };
      
      // Optimistic update: Update local state immediately
      const updatedShotList = {
        ...activeItem.shotList,
        shots: activeItem.shotList.shots.map(s => 
          s.id === updatedShot.id ? updatedShot : s
        ),
        updatedAt: new Date().toISOString(),
      };

      // Update local shotLists state optimistically
      // This will be handled by the parent component's state update
      
      // Save to backend asynchronously (non-blocking)
      if (onShotUpdate) {
        // Don't await - let it run in background
        onShotUpdate(updatedShotList, updatedShot).catch((error) => {
          console.error('Error saving shot update:', error);
          // Could show error toast here if needed
        });
      }

      const logEntry: ActivityLogEntry = {
        id: `log-${Date.now()}`,
        userId: currentUserId || 'unknown',
        userName: crewMembers.find(m => m.id === currentUserId)?.name || 'Ukjent',
        action: 'status_change',
        targetType: 'shot',
        targetId: activeItem.shot.id,
        targetName: activeItem.shot.description || activeItem.shot.shotType,
        timestamp: new Date().toISOString(),
        details: { from: activeItem.shot.status, to: newStatus },
      };
      setActivityLog(prev => [logEntry, ...prev]);
    }
  };

  const stats = useMemo(() => ({
    total: allShots.length,
    completed: allShots.filter(({ shot }) => shot.status === 'completed').length,
    inProgress: allShots.filter(({ shot }) => shot.status === 'in_progress').length,
    critical: allShots.filter(({ shot }) => shot.priority === 'critical').length,
    unassigned: allShots.filter(({ shot }) => !shot.assigneeId).length,
  }), [allShots]);

  const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      bgcolor: '#0a0a0a',
      minHeight: 0,
      overflow: 'hidden',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
    }}>
      <Box sx={{ 
        p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 }, 
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2, md: 1.5, lg: 2, xl: 3 } }}>
            <TeamIcon sx={{ color: '#e91e63', fontSize: { xs: 24, sm: 28, md: 26, lg: 30, xl: 36 } }} />
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.1rem', sm: '1.5rem', md: '1.4rem', lg: '1.6rem', xl: '2rem' } }}>
              Team Dashboard
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 0.75, md: 0.5, lg: 0.75, xl: 1 } }}>
            <Tooltip title="Aktivitetslogg">
              <IconButton 
                onClick={() => setShowActivityPanel(!showActivityPanel)} 
                sx={{ color: '#fff', p: { xs: 0.75, sm: 1, md: 0.75, lg: 1, xl: 1.5 } }}
              >
                <Badge badgeContent={activityLog.length} color="error" max={99}>
                  <HistoryIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 32 } }} />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Varsler">
              <IconButton sx={{ color: '#fff', p: { xs: 0.75, sm: 1, md: 0.75, lg: 1, xl: 1.5 } }}>
                <NotificationIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 32 } }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Collapsible Stats Section */}
        <Box 
          onClick={() => setStatsExpanded(!statsExpanded)}
          sx={{ 
            display: { xs: 'flex', lg: 'none' }, 
            alignItems: 'center', 
            justifyContent: 'space-between',
            cursor: 'pointer',
            py: 1,
            px: 0.5,
            mb: 1,
            borderRadius: 1,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 500 }}>
              Statistikk
            </Typography>
            <Chip 
              label={`${progress.toFixed(0)}% fullført`} 
              size="small" 
              sx={{ 
                bgcolor: 'rgba(76,175,80,0.2)', 
                color: '#4caf50', 
                height: 20, 
                fontSize: '0.65rem' 
              }} 
            />
          </Box>
          {statsExpanded ? (
            <ExpandLessIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
          ) : (
            <ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
          )}
        </Box>

        <Collapse in={statsExpanded || !isMobile && !isTablet}>
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { 
              xs: 'repeat(2, 1fr)', 
              sm: 'repeat(3, 1fr)', 
              md: 'repeat(4, 1fr)',
              lg: 'repeat(5, 1fr)',
              xl: 'repeat(5, 1fr)' 
            }, 
                gap: { xs: 1, sm: 1.25, md: 1, lg: 1.25, xl: 2 },
            mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 } 
          }}>
            <Paper sx={{ 
              p: { xs: 1, sm: 1.25, md: 1, lg: 1.25, xl: 2 }, 
              bgcolor: 'rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: { xs: 70, sm: 80, md: 75, lg: 85, xl: 110 },
            }}>
              <Typography variant="caption" sx={{ 
                color: 'rgba(255,255,255,0.87)', 
                fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.7rem', lg: '0.72rem', xl: '0.875rem' },
                mb: { xs: 0.5, sm: 0.75, md: 0.5, lg: 0.625, xl: 1 },
                textAlign: 'center',
              }}>Totalt</Typography>
              <Typography sx={{ 
                color: '#fff', 
                fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' }, 
                fontWeight: 700,
                lineHeight: 1.2,
              }}>{stats.total}</Typography>
            </Paper>
            <Paper sx={{ 
              p: { xs: 1, sm: 1.25, md: 1, lg: 1.25, xl: 2 }, 
              bgcolor: 'rgba(76,175,80,0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: { xs: 70, sm: 80, md: 75, lg: 85, xl: 110 },
            }}>
              <Typography variant="caption" sx={{ 
                color: 'rgba(255,255,255,0.87)', 
                fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.7rem', lg: '0.72rem', xl: '0.875rem' },
                mb: { xs: 0.5, sm: 0.75, md: 0.5, lg: 0.625, xl: 1 },
                textAlign: 'center',
              }}>Fullført</Typography>
              <Typography sx={{ 
                color: '#4caf50', 
                fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' }, 
                fontWeight: 700,
                lineHeight: 1.2,
              }}>{stats.completed}</Typography>
            </Paper>
            <Paper sx={{ 
              p: { xs: 1, sm: 1.25, md: 1, lg: 1.25, xl: 2 }, 
              bgcolor: 'rgba(33,150,243,0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: { xs: 70, sm: 80, md: 75, lg: 85, xl: 110 },
            }}>
              <Typography variant="caption" sx={{ 
                color: 'rgba(255,255,255,0.87)', 
                fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.7rem', lg: '0.72rem', xl: '0.875rem' },
                mb: { xs: 0.5, sm: 0.75, md: 0.5, lg: 0.625, xl: 1 },
                textAlign: 'center',
              }}>Pågår</Typography>
              <Typography sx={{ 
                color: '#2196f3', 
                fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' }, 
                fontWeight: 700,
                lineHeight: 1.2,
              }}>{stats.inProgress}</Typography>
            </Paper>
            <Paper sx={{ 
              p: { xs: 1, sm: 1.25, md: 1, lg: 1.25, xl: 2 }, 
              bgcolor: 'rgba(244,67,54,0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: { xs: 70, sm: 80, md: 75, lg: 85, xl: 110 },
            }}>
              <Typography variant="caption" sx={{ 
                color: 'rgba(255,255,255,0.87)', 
                fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.7rem', lg: '0.72rem', xl: '0.875rem' },
                mb: { xs: 0.5, sm: 0.75, md: 0.5, lg: 0.625, xl: 1 },
                textAlign: 'center',
              }}>Kritisk</Typography>
              <Typography sx={{ 
                color: '#f44336', 
                fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' }, 
                fontWeight: 700,
                lineHeight: 1.2,
              }}>{stats.critical}</Typography>
            </Paper>
            <Paper sx={{ 
              p: { xs: 1, sm: 1.25, md: 1, lg: 1.25, xl: 2 }, 
              bgcolor: 'rgba(255,152,0,0.1)',
              gridColumn: { xs: 'span 2', sm: 'span 1' },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: { xs: 70, sm: 80, md: 75, lg: 85, xl: 110 },
            }}>
              <Typography variant="caption" sx={{ 
                color: 'rgba(255,255,255,0.87)', 
                fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.7rem', lg: '0.72rem', xl: '0.875rem' },
                mb: { xs: 0.5, sm: 0.75, md: 0.5, lg: 0.625, xl: 1 },
                textAlign: 'center',
              }}>Ikke tilordnet</Typography>
              <Typography sx={{ 
                color: '#ff9800', 
                fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' }, 
                fontWeight: 700,
                lineHeight: 1.2,
              }}>{stats.unassigned}</Typography>
            </Paper>
          </Box>

          <Box sx={{ mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 } }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              mb: { xs: 0.75, sm: 1, md: 0.75, lg: 1, xl: 1.5 },
              alignItems: 'center',
            }}>
              <Typography variant="caption" sx={{ 
                color: 'rgba(255,255,255,0.87)',
                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.75rem', lg: '0.78rem', xl: '0.9rem' },
                fontWeight: { xs: 500, sm: 400 },
              }}>
                Fremdrift
              </Typography>
              <Typography variant="caption" sx={{ 
                color: '#4caf50',
                fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.8rem', lg: '0.85rem', xl: '1rem' },
                fontWeight: { xs: 600, sm: 500 },
              }}>
                {progress.toFixed(0)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: { xs: 6, sm: 8, md: 7, lg: 9, xl: 12 },
                borderRadius: { xs: 3, sm: 4, md: 3.5, lg: 4.5, xl: 6 },
                bgcolor: 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': { 
                  bgcolor: '#4caf50', 
                  borderRadius: { xs: 3, sm: 4, md: 3.5, lg: 4.5, xl: 6 },
                  transition: 'transform 0.4s ease',
                },
              }}
            />
          </Box>
        </Collapse>

        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.75, xl: 2.5 }, 
          flexWrap: 'wrap', 
          alignItems: { xs: 'stretch', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
        }}>
          <Tabs
            value={viewMode}
            onChange={(_: React.SyntheticEvent, v: ViewMode) => setViewMode(v)}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons={isMobile ? 'auto' : false}
            allowScrollButtonsMobile
            sx={{
              minHeight: { xs: 40, sm: 44, md: 42, lg: 46, xl: 56 },
              width: { xs: '100%', sm: 'auto' },
              order: { xs: 1, sm: 1 },
              '& .MuiTab-root': { 
                minHeight: { xs: 40, sm: 44, md: 42, lg: 46, xl: 56 }, 
                color: 'rgba(255,255,255,0.87)',
                minWidth: { xs: 70, sm: 90, md: 85, lg: 100, xl: 130 },
                maxWidth: { xs: 'none', sm: 160, xl: 200 },
                px: { xs: 1, sm: 1.5, md: 1.25, lg: 1.75, xl: 2.5 },
                fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.75rem', lg: '0.82rem', xl: '1rem' },
                textTransform: 'none',
                fontWeight: { xs: 500, sm: 400 },
                '& .MuiTab-iconWrapper': {
                  marginRight: { xs: 0.5, sm: 1, md: 0.75, lg: 0.875, xl: 1.5 },
                },
              },
              '& .Mui-selected': { 
                color: '#e91e63',
                fontWeight: 600,
              },
              '& .MuiTabs-scrollButtons': { 
                color: 'rgba(255,255,255,0.87)',
                width: { xs: 32, sm: 40, md: 36, lg: 38, xl: 48 },
              },
              '& .MuiTabs-indicator': {
                height: { xs: 3, sm: 3, md: 3, lg: 3.5, xl: 4 },
                borderRadius: '3px 3px 0 0',
              },
            }}
          >
            <Tab 
              icon={<KanbanIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 26 } }} />} 
              iconPosition={isMobile ? 'top' : 'start'} 
              label={isMobile ? '' : 'Kanban'} 
              value="kanban"
              sx={{
                '& .MuiTab-iconWrapper': {
                  marginBottom: { xs: 0.25, sm: 0 },
                },
              }}
            />
            <Tab 
              icon={<TableIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 26 } }} />} 
              iconPosition={isMobile ? 'top' : 'start'} 
              label={isMobile ? '' : 'Tabell'} 
              value="table"
              sx={{
                '& .MuiTab-iconWrapper': {
                  marginBottom: { xs: 0.25, sm: 0 },
                },
              }}
            />
            <Tab 
              icon={<TimelineIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 26 } }} />} 
              iconPosition={isMobile ? 'top' : 'start'} 
              label={isMobile ? '' : 'Tidslinje'} 
              value="timeline"
              sx={{
                '& .MuiTab-iconWrapper': {
                  marginBottom: { xs: 0.25, sm: 0 },
                },
              }}
            />
            <Tab 
              icon={<PersonIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 26 } }} />} 
              iconPosition={isMobile ? 'top' : 'start'} 
              label={isMobile ? '' : 'Arbeid'} 
              value="workload"
              sx={{
                '& .MuiTab-iconWrapper': {
                  marginBottom: { xs: 0.25, sm: 0 },
                },
              }}
            />
          </Tabs>

          <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' }, order: { xs: 0, sm: 2 } }} />

          <Box sx={{ 
            display: 'flex', 
            gap: { xs: 0.75, sm: 1 }, 
            width: { xs: '100%', sm: 'auto' },
            flexWrap: { xs: 'wrap', sm: 'nowrap' },
            order: { xs: 2, sm: 3 },
            alignItems: { xs: 'stretch', sm: 'center' },
          }}>
            <TextField
              size="small"
              placeholder="Søk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)', mr: 0.5, fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> }}
              sx={{
                flex: { xs: 1, sm: 'none' },
                width: { xs: '100%', sm: 160, md: 170, lg: 185, xl: 240 },
                minWidth: { xs: 100 },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                  height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused fieldset': { borderColor: '#e91e63' },
                },
                '& .MuiInputBase-input': {
                  py: { xs: 0.75, sm: 1, md: 0.875, lg: 1.125, xl: 1.5 },
                  px: { xs: 0.75, sm: 1, md: 0.875, lg: 0.95, xl: 1.25 },
                },
              }}
            />

            <FormControl size="small" sx={{ minWidth: { xs: 90, sm: 120, md: 110, lg: 125, xl: 160 }, flex: { xs: 1, sm: 'none' } }}>
              <InputLabel sx={{ 
                color: 'rgba(255,255,255,0.87)', 
                fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.8rem', lg: '0.85rem', xl: '1rem' },
                '&.Mui-focused': { color: '#e91e63' },
              }}>
                Tilordnet
              </InputLabel>
              <Select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                label="Tilordnet"
                sx={{ 
                  color: '#fff', 
                  fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                  height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e91e63' },
                  '& .MuiSelect-select': { 
                    py: { xs: 0.75, sm: 1, md: 0.875, lg: 1.125, xl: 1.5 },
                    px: { xs: 0.75, sm: 1, md: 0.875, lg: 0.95, xl: 1.25 },
                  },
                }}
              >
                <MenuItem value="all" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Alle</MenuItem>
                <MenuItem value="unassigned" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Ikke tilordnet</MenuItem>
                  {crewMembers.map(m => (
                  <MenuItem key={m.id} value={m.id} sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', xl: '1rem' } }}>
                    {m.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: { xs: 80, sm: 100, md: 95, lg: 110, xl: 140 }, flex: { xs: 1, sm: 'none' } }}>
              <InputLabel sx={{ 
                color: 'rgba(255,255,255,0.87)', 
                fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.8rem', lg: '0.85rem', xl: '1rem' },
                '&.Mui-focused': { color: '#e91e63' },
              }}>
                Prioritet
              </InputLabel>
              <Select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                label="Prioritet"
                sx={{ 
                  color: '#fff', 
                  fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                  height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e91e63' },
                  '& .MuiSelect-select': { 
                    py: { xs: 0.75, sm: 1, md: 0.875, lg: 1.125, xl: 1.5 },
                    px: { xs: 0.75, sm: 1, md: 0.875, lg: 0.95, xl: 1.25 },
                  },
                }}
              >
                <MenuItem value="all" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' } }}>Alle</MenuItem>
                {Object.entries(priorityConfig).map(([key, val]) => (
                  <MenuItem key={key} value={key} sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: val.color }}>
                      {val.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Tooltip title="Eksporter som CSV">
              <IconButton
                size="small"
                onClick={() => exportToCSV(allShots, crewMembers)}
                sx={{ 
                  color: 'rgba(255,255,255,0.87)',
                  display: { xs: 'none', sm: 'flex' },
                  '&:hover': { color: '#4caf50' },
                }}
              >
                <ExcelIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Eksporter som PDF">
              <IconButton
                size="small"
                onClick={() => exportToPDF(allShots, crewMembers)}
                sx={{ 
                  color: 'rgba(255,255,255,0.87)',
                  display: { xs: 'none', sm: 'flex' },
                  '&:hover': { color: '#e91e63' },
                }}
              >
                <PdfIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: 'rgba(255,255,255,0.2)' }} />

            <Tooltip title="Generer Call Sheet">
              <Button
                size="small"
                variant="outlined"
                startIcon={<CallSheetIcon />}
                onClick={() => setShowCallSheetDrawer(true)}
                sx={{ 
                  color: '#8b5cf6',
                  borderColor: 'rgba(139, 92, 246, 0.5)',
                  display: { xs: 'none', md: 'flex' },
                  '&:hover': { 
                    borderColor: '#8b5cf6',
                    bgcolor: 'rgba(139, 92, 246, 0.1)',
                  },
                }}
              >
                Call Sheet
              </Button>
            </Tooltip>
            
            {/* Mobile Call Sheet button */}
            <Tooltip title="Call Sheet">
              <IconButton
                size="small"
                onClick={() => setShowCallSheetDrawer(true)}
                sx={{ 
                  color: '#8b5cf6',
                  display: { xs: 'flex', md: 'none' },
                  '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.1)' },
                }}
              >
                <CallSheetIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      <Box sx={{ 
        flex: 1, 
        overflow: 'hidden', 
        display: 'flex', 
        minHeight: 0,
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}>
        <Box sx={{ 
          flex: 1, 
          overflow: 'hidden', 
          px: { xs: 1, sm: 1.5, md: 2 },
          py: { xs: 1, sm: 1.5, md: 2 },
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          height: '100%',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}>
          {viewMode === 'kanban' && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <Box sx={{ 
                display: { xs: 'flex', sm: 'grid' },
                gridTemplateColumns: { xs: 'none', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: { xs: 1, sm: 1.25, md: 1.5 }, 
                height: '100%',
                minHeight: 0,
                flexDirection: { xs: 'column', sm: 'row' },
                overflow: 'hidden',
                pb: { xs: 2, sm: 0 },
                alignItems: { xs: 'stretch', sm: 'stretch' },
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                margin: 0,
              }}>
                {statusColumns.map(column => (
                  <Paper
                    key={column.id}
                    sx={{
                      flex: { xs: 'none', sm: 'none' },
                      minWidth: 0,
                      maxWidth: { xs: '100%', sm: '100%' },
                      width: { xs: '100%', sm: '100%' },
                      bgcolor: 'rgba(255,255,255,0.02)',
                      borderRadius: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      border: '1px solid rgba(255,255,255,0.05)',
                      height: { xs: 'auto', sm: '100%' },
                      maxHeight: { xs: 'none', sm: '100%' },
                      minHeight: { xs: 'auto', sm: 0 },
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                      margin: 0,
                    }}
                  >
                    <Box
                      sx={{
                        p: { xs: 2, sm: 1.5 },
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: { xs: 1.5, sm: 1 },
                        flexShrink: 0,
                      }}
                    >
                      <Box sx={{ color: column.color, display: 'flex', alignItems: 'center', '& svg': { fontSize: { xs: 24, sm: 20 } } }}>
                        {column.icon}
                      </Box>
                      <Typography variant="subtitle1" sx={{ 
                        color: '#fff', 
                        fontWeight: 600,
                        fontSize: { xs: '1rem', sm: '0.9rem' },
                      }}>
                        {column.label}
                      </Typography>
                      <Chip
                        label={shotsByStatus[column.id].length}
                        size="small"
                        sx={{
                          ml: 'auto',
                          height: { xs: 26, sm: 20 },
                          minWidth: { xs: 32, sm: 24 },
                          bgcolor: `${column.color}22`,
                          color: column.color,
                          fontSize: { xs: '0.85rem', sm: '0.75rem' },
                        }}
                      />
                    </Box>
                    <DroppableColumn id={column.id}>
                      <SortableContext
                        items={shotsByStatus[column.id].map(({ shot }) => shot.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {shotsByStatus[column.id].map(({ shot, shotList }) => (
                          <KanbanCard
                            key={shot.id}
                            shot={shot}
                            shotList={shotList}
                            crewMembers={crewMembers}
                            onUpdate={(updates) => handleShotUpdate(shotList, shot, updates)}
                            isInDropZone={false}
                          />
                        ))}
                      </SortableContext>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          width: '100%',
                          gap: { xs: 1, sm: 0.5 },
                          mt: shotsByStatus[column.id].length > 0 ? { xs: 1, sm: 0.5 } : 0,
                          p: shotsByStatus[column.id].length === 0 ? { xs: 2, sm: 1.5 } : 0,
                          flex: shotsByStatus[column.id].length === 0 ? 1 : 'none',
                        }}
                      >
                        {[1, 2, 3, 4].map((i) => (
                          <Box
                            key={i}
                            sx={{
                              width: '100%',
                              p: { xs: 2, sm: 1.5 },
                              textAlign: 'center',
                              color: 'rgba(255,255,255,0.6)',
                              border: '2px dashed rgba(255,255,255,0.15)',
                              borderRadius: 2,
                              minHeight: { xs: 60, sm: 50 },
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontSize: { xs: '0.85rem', sm: '0.75rem' },
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Dra shots hit
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </DroppableColumn>
                  </Paper>
                ))}
              <DragOverlay>
                {activeId ? (() => {
                  const activeItem = allShots.find(({ shot }) => shot.id === activeId);
                  if (!activeItem) return null;
                  const priority = priorityConfig[activeItem.shot.priority || 'important'];
                  return (
                    <Card
                      sx={{
                        width: 280,
                        bgcolor: '#1a1a2e',
                        border: `2px solid ${priority.color}`,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        transform: 'rotate(3deg)',
                        opacity: 0.95,
                        cursor: 'grabbing',
                      }}
                    >
                      <CardContent sx={{ p: 1.5 }}>
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, mb: 1 }}>
                          {activeItem.shot.description || activeItem.shot.shotType}
                        </Typography>
                        <Chip
                          label={priority.label}
                          size="small"
                          sx={{
                            bgcolor: priority.bgColor,
                            color: priority.color,
                            height: 20,
                            fontSize: '10px',
                          }}
                        />
                      </CardContent>
                    </Card>
                  );
                })() : null}
              </DragOverlay>
              </Box>
            </DndContext>
          )}

          {viewMode === 'workload' && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 },
              p: { xs: 0.5, sm: 1, md: 0.75, lg: 1.25, xl: 2 },
            }}>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { 
                  xs: '1fr', 
                  sm: 'repeat(auto-fill, minmax(280px, 1fr))',
                  md: 'repeat(auto-fill, minmax(280px, 1fr))',
                  lg: 'repeat(auto-fill, minmax(340px, 1fr))',
                  xl: 'repeat(auto-fill, minmax(400px, 1fr))',
                }, 
                gap: { xs: 1.5, sm: 2, md: 1.5, lg: 2, xl: 3 } 
              }}>
                {crewMembers.map(member => {
                  const load = workloadByMember[member.id] || { assigned: 0, completed: 0, inProgress: 0, totalTime: 0 };
                  const completionRate = load.assigned > 0 ? (load.completed / load.assigned) * 100 : 0;
                  const isOverloaded = load.assigned > 10;
                  const isExpanded = expandedMembers.has(member.id);
                  const memberShots = allShots.filter(({ shot }) => shot.assigneeId === member.id);

                  return (
                    <Paper
                      key={member.id}
                      sx={{
                        p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 },
                        bgcolor: isOverloaded ? 'rgba(244,67,54,0.1)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isOverloaded ? 'rgba(244,67,54,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: 2,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2, md: 1.5, lg: 2, xl: 3 }, mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 } }}>
                        <Avatar sx={{ 
                          bgcolor: '#e91e63',
                          width: { xs: 36, sm: 40, md: 38, lg: 44, xl: 56 },
                          height: { xs: 36, sm: 40, md: 38, lg: 44, xl: 56 },
                          fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.1rem', xl: '1.5rem' },
                        }}>{member.name.charAt(0)}</Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle1" sx={{ 
                            color: '#fff', 
                            fontWeight: 600,
                            fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.25rem' },
                          }}>
                            {member.name}
                          </Typography>
                          <Typography variant="caption" sx={{ 
                            color: 'rgba(255,255,255,0.87)',
                            fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.7rem', lg: '0.8rem', xl: '1rem' },
                          }}>
                            {member.role}
                          </Typography>
                        </Box>
                        {isOverloaded && (
                          <Tooltip title="Overbelastet">
                            <WarningIcon sx={{ color: '#f44336' }} />
                          </Tooltip>
                        )}
                        <Tooltip title="Tilordne shots">
                          <IconButton 
                            size="small" 
                            onClick={() => {
                              setSelectedMemberForAssign(member.id);
                              setAssignDialogOpen(true);
                            }}
                            sx={{ color: '#e91e63' }}
                          >
                            <AddIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      <Box sx={{ 
                        display: 'flex', 
                        gap: { xs: 0.5, sm: 1 }, 
                        mb: { xs: 1.5, sm: 2 }, 
                        flexWrap: 'wrap',
                      }}>
                        <Chip 
                          label={`${load.assigned} tilordnet`} 
                          size="small" 
                          sx={{ 
                            bgcolor: 'rgba(255,255,255,0.1)', 
                            color: '#fff',
                            height: { xs: 22, sm: 24, md: 23, lg: 24, xl: 30 },
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.76rem', xl: '0.9rem' },
                            fontWeight: { xs: 500, sm: 400 },
                          }} 
                        />
                        <Chip 
                          label={`${load.completed} fullført`} 
                          size="small" 
                          sx={{ 
                            bgcolor: 'rgba(76,175,80,0.2)', 
                            color: '#4caf50',
                            height: { xs: 22, sm: 24, md: 23, lg: 24, xl: 30 },
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.76rem', xl: '0.9rem' },
                            fontWeight: { xs: 500, sm: 400 },
                          }} 
                        />
                        <Chip 
                          label={`${load.inProgress} pågår`} 
                          size="small" 
                          sx={{ 
                            bgcolor: 'rgba(33,150,243,0.2)', 
                            color: '#2196f3',
                            height: { xs: 22, sm: 24, md: 23, lg: 24, xl: 30 },
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.76rem', xl: '0.9rem' },
                            fontWeight: { xs: 500, sm: 400 },
                          }} 
                        />
                      </Box>

                      <Box sx={{ mb: { xs: 1, sm: 1.5, md: 1.25, lg: 1.375, xl: 2 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.7, xl: 1 } }}>
                          <Typography variant="caption" sx={{ 
                            color: 'rgba(255,255,255,0.87)',
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.76rem', xl: '0.9rem' },
                          }}>
                            Fullføringsgrad
                          </Typography>
                          <Typography variant="caption" sx={{ 
                            color: '#4caf50',
                            fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.78rem', lg: '0.82rem', xl: '1rem' },
                          }}>
                            {completionRate.toFixed(0)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={completionRate}
                          sx={{
                            height: { xs: 6, sm: 7, md: 6.5, lg: 7.5, xl: 10 },
                            borderRadius: { xs: 3, sm: 3.5, md: 3.25, lg: 3.75, xl: 5 },
                            bgcolor: 'rgba(255,255,255,0.1)',
                            '& .MuiLinearProgress-bar': { 
                              bgcolor: '#4caf50',
                              borderRadius: { xs: 3, sm: 3.5, md: 3.25, lg: 3.75, xl: 5 },
                              transition: 'transform 0.4s ease',
                            },
                          }}
                        />
                      </Box>

                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        mb: memberShots.length > 0 ? { xs: 1.5, sm: 2 } : 0,
                        flexWrap: 'wrap',
                        gap: { xs: 0.5, sm: 1 },
                      }}>
                        <Typography variant="caption" sx={{ 
                          color: 'rgba(255,255,255,0.87)',
                          fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                        }}>
                          Estimert tid: {load.totalTime} min
                        </Typography>
                        {memberShots.length > 3 && (
                          <Button
                            size="small"
                            onClick={() => {
                              setExpandedMembers(prev => {
                                const next = new Set(prev);
                                if (next.has(member.id)) {
                                  next.delete(member.id);
                                } else {
                                  next.add(member.id);
                                }
                                return next;
                              });
                            }}
                            endIcon={isExpanded ? <ExpandLessIcon sx={{ fontSize: { xs: 16, sm: 18 } }} /> : <ExpandMoreIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />}
                            sx={{ 
                              color: 'rgba(255,255,255,0.87)', 
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                              minWidth: 'auto',
                              py: { xs: 0.5, sm: 0.75 },
                              px: { xs: 1, sm: 1.5 },
                            }}
                          >
                            {isExpanded ? 'Skjul' : `+${memberShots.length - 3} flere`}
                          </Button>
                        )}
                      </Box>

                      {memberShots.length > 0 && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 0.75, sm: 1 } }}>
                          {(isExpanded ? memberShots : memberShots.slice(0, 3)).map(({ shot, shotList }) => {
                            const priority = priorityConfig[shot.priority || 'important'];
                            const statusCol = statusColumns.find(s => s.id === (shot.status || 'not_started'));
                            return (
                              <Box
                                key={shot.id}
                                sx={{
                                  p: { xs: 1, sm: 1.25, md: 1.5 },
                                  bgcolor: 'rgba(0,0,0,0.2)',
                                  borderRadius: 1,
                                  borderLeft: `3px solid ${priority.color}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: { xs: 0.75, sm: 1 },
                                }}
                              >
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="body2" sx={{ 
                                    color: '#fff', 
                                    fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' },
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontWeight: { xs: 500, sm: 400 },
                                  }}>
                                    {shot.description || shot.shotType}
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 0.75 }, mt: { xs: 0.5, sm: 0.75 }, flexWrap: 'wrap' }}>
                                    <Chip 
                                      label={statusCol?.label} 
                                      size="small" 
                                      sx={{ 
                                        height: { xs: 18, sm: 20, md: 22 }, 
                                        fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem' },
                                        bgcolor: `${statusCol?.color}22`,
                                        color: statusCol?.color,
                                        fontWeight: { xs: 500, sm: 400 },
                                      }} 
                                    />
                                    <Chip 
                                      label={priority.label} 
                                      size="small" 
                                      sx={{ 
                                        height: { xs: 18, sm: 20, md: 22 }, 
                                        fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem' },
                                        bgcolor: priority.bgColor,
                                        color: priority.color,
                                        fontWeight: { xs: 500, sm: 400 },
                                      }} 
                                    />
                                  </Box>
                                </Box>
                                <Tooltip title="Fjern tilordning">
                                  <IconButton
                                    size="small"
                                    onClick={async () => {
                                      if (onShotUpdate) {
                                        await onShotUpdate(shotList, { ...shot, assigneeId: undefined });
                                      }
                                    }}
                                    sx={{ 
                                      color: 'rgba(255,255,255,0.7)', 
                                      '&:hover': { color: '#f44336' },
                                      p: { xs: 0.5, sm: 0.75, md: 1 },
                                      minWidth: { xs: 32, sm: 36, md: 40 },
                                      minHeight: { xs: 32, sm: 36, md: 40 },
                                    }}
                                  >
                                    <PersonIcon sx={{ fontSize: { xs: 16, sm: 18, md: 20 } }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Paper>
                  );
                })}

                {workloadByMember['unassigned'] && workloadByMember['unassigned'].assigned > 0 && (
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: 'rgba(255,152,0,0.1)',
                      border: '1px solid rgba(255,152,0,0.3)',
                      borderRadius: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: '#ff9800' }}>
                        <PersonIcon />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
                          Ikke tilordnet
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#ff9800' }}>
                          Trenger tilordning
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label={`${workloadByMember['unassigned'].assigned} shots`}
                      sx={{ bgcolor: 'rgba(255,152,0,0.2)', color: '#ff9800', mb: 2 }}
                    />
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {allShots.filter(({ shot }) => !shot.assigneeId).map(({ shot, shotList }) => {
                        const priority = priorityConfig[shot.priority || 'important'];
                        return (
                          <Box
                            key={shot.id}
                            sx={{
                              p: 1.5,
                              bgcolor: 'rgba(0,0,0,0.2)',
                              borderRadius: 1,
                              borderLeft: `3px solid ${priority.color}`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" sx={{ color: '#fff', fontSize: '0.8rem' }}>
                                {shot.description || shot.shotType}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                                {shotList.sceneName || 'Scene'}
                              </Typography>
                            </Box>
                            <FormControl size="small" sx={{ minWidth: 100 }}>
                              <Select
                                value=""
                                displayEmpty
                                onChange={async (e) => {
                                  const memberId = e.target.value as string;
                                  if (memberId && onShotUpdate) {
                                    await onShotUpdate(shotList, { ...shot, assigneeId: memberId });
                                  }
                                }}
                                sx={{ 
                                  color: '#fff', 
                                  fontSize: '0.75rem',
                                  height: 32,
                                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,152,0,0.4)' },
                                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9800' },
                                }}
                              >
                                <MenuItem value="" disabled>Tilordne</MenuItem>
                                {crewMembers.map(m => (
                                  <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Box>
                        );
                      })}
                    </Box>
                  </Paper>
                )}
              </Box>

              <Dialog
                open={assignDialogOpen}
                onClose={() => setAssignDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                  sx: { bgcolor: '#1a1a2e', color: '#fff' }
                }}
              >
                <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  Tilordne shots til {crewMembers.find(m => m.id === selectedMemberForAssign)?.name}
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 2 }}>
                    Velg shots å tilordne:
                  </Typography>
                  {allShots.filter(({ shot }) => !shot.assigneeId).length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', py: 4 }}>
                      Ingen ledige shots å tilordne
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {allShots.filter(({ shot }) => !shot.assigneeId).map(({ shot, shotList }) => {
                        const priority = priorityConfig[shot.priority || 'important'];
                        return (
                          <Box
                            key={shot.id}
                            sx={{
                              p: 1.5,
                              bgcolor: 'rgba(255,255,255,0.05)',
                              borderRadius: 1,
                              borderLeft: `3px solid ${priority.color}`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                            }}
                            onClick={async () => {
                              if (selectedMemberForAssign && onShotUpdate) {
                                await onShotUpdate(shotList, { ...shot, assigneeId: selectedMemberForAssign });
                              }
                            }}
                          >
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" sx={{ color: '#fff' }}>
                                {shot.description || shot.shotType}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                                {shotList.sceneName || 'Scene'}
                              </Typography>
                            </Box>
                            <AddIcon sx={{ color: '#e91e63' }} />
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </DialogContent>
                <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
                  <Button onClick={() => setAssignDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    Lukk
                  </Button>
                </DialogActions>
              </Dialog>
            </Box>
          )}

          {viewMode === 'timeline' && (() => {
            const today = new Date();
            const daysToShow = 14;
            const days = Array.from({ length: daysToShow }, (_, i) => {
              const d = new Date(today);
              d.setDate(today.getDate() + i);
              return d;
            });
            const dayNames = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];
            
            return (
              <Box sx={{ 
                p: { xs: 0.5, sm: 1, md: 0.75, lg: 1.5, xl: 2.5 }, 
                overflow: 'auto',
                maxWidth: '100%',
                height: '100%',
              }}>
                <Box sx={{ minWidth: { xs: 600, sm: 800, md: 850, lg: 950, xl: 1200 } }}>
                  <Box sx={{ 
                    display: 'flex', 
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                  }}>
                    <Box sx={{ 
                      width: { xs: 120, sm: 150, md: 160, lg: 180, xl: 240 }, 
                      minWidth: { xs: 120, sm: 150, md: 160, lg: 180, xl: 240 }, 
                      p: { xs: 0.75, sm: 1, md: 0.875, lg: 1.25, xl: 2 }, 
                      borderRight: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      <Typography variant="caption" sx={{ 
                        color: 'rgba(255,255,255,0.87)', 
                        fontWeight: 600,
                        fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.7rem', lg: '0.75rem', xl: '0.9rem' },
                      }}>
                        Shot / Oppgave
                      </Typography>
                    </Box>
                    {days.map((day, i) => {
                      const isToday = day.toDateString() === today.toDateString();
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      return (
                        <Box 
                          key={i} 
                          sx={{ 
                            flex: 1, 
                            minWidth: { xs: 40, sm: 45, md: 42, lg: 50, xl: 65 }, 
                            p: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.875, xl: 1.25 }, 
                            textAlign: 'center',
                            borderRight: '1px solid rgba(255,255,255,0.05)',
                            bgcolor: isToday ? 'rgba(233,30,99,0.1)' : isWeekend ? 'rgba(255,255,255,0.02)' : 'transparent',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Typography variant="caption" sx={{ 
                            color: isToday ? '#e91e63' : 'rgba(255,255,255,0.5)', 
                            display: 'block',
                            fontWeight: isToday ? 600 : 400,
                            fontSize: { xs: '0.55rem', sm: '0.6rem', md: '0.58rem', lg: '0.65rem', xl: '0.8rem' },
                            mb: { xs: 0.25, sm: 0.5, md: 0.375, lg: 0.45, xl: 0.75 },
                          }}>
                            {dayNames[day.getDay()]}
                          </Typography>
                          <Typography variant="caption" sx={{ 
                            color: isToday ? '#e91e63' : '#fff', 
                            fontWeight: isToday ? 700 : 500,
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.82rem', xl: '1rem' },
                            lineHeight: 1.2,
                          }}>
                            {day.getDate()}
                          </Typography>
                          {i === 0 && (
                            <Typography variant="caption" sx={{ 
                              color: 'rgba(255,255,255,0.7)', 
                              display: 'block', 
                              fontSize: { xs: '0.5rem', sm: '0.55rem', md: '0.55rem', lg: '0.6rem', xl: '0.75rem' },
                              mt: { xs: 0.25, sm: 0.5, md: 0.375, lg: 0.45, xl: 0.75 },
                            }}>
                              {monthNames[day.getMonth()]}
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                  
                  {allShots.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        Ingen shots å vise i tidslinjen
                      </Typography>
                    </Box>
                  ) : (
                    allShots.map(({ shot, shotList }, idx) => {
                      const assignee = crewMembers.find(m => m.id === shot.assigneeId);
                      const priority = priorityConfig[shot.priority || 'important'];
                      const statusCol = statusColumns.find(s => s.id === (shot.status || 'not_started'));
                      const shotStatus = shot.status || 'not_started';
                      const statusOffset = shotStatus === 'completed' ? 0 : shotStatus === 'in_progress' ? 3 : 7;
                      const barStart = statusOffset + (idx % 3);
                      const barLength = Math.max(1, Math.min(shot.estimatedTime ? Math.ceil(shot.estimatedTime / 30) : 2, daysToShow - barStart - 1));
                      
                      return (
                        <Box 
                          key={shot.id}
                          sx={{ 
                            display: 'flex', 
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                          }}
                        >
                          <Box sx={{ 
                            width: { xs: 120, sm: 150, md: 160, lg: 180, xl: 240 }, 
                            minWidth: { xs: 120, sm: 150, md: 160, lg: 180, xl: 240 }, 
                            p: { xs: 0.75, sm: 1, md: 0.875, lg: 1.25, xl: 2 }, 
                            borderRight: '1px solid rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1.125, xl: 1.5 },
                          }}>
                            <Box sx={{ 
                              width: { xs: 7, sm: 8, md: 8, lg: 9, xl: 12 }, 
                              height: { xs: 7, sm: 8, md: 8, lg: 9, xl: 12 }, 
                              borderRadius: '50%', 
                              bgcolor: statusCol?.color,
                              flexShrink: 0,
                            }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="caption" sx={{ 
                                color: '#fff', 
                                fontWeight: { xs: 500, sm: 500, md: 400 }, 
                                display: 'block',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '1rem' },
                                lineHeight: 1.3,
                              }}>
                                {shot.description || shot.shotType}
                              </Typography>
                              <Typography variant="caption" sx={{ 
                                color: 'rgba(255,255,255,0.7)', 
                                fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.65rem', lg: '0.7rem', xl: '0.875rem' },
                                display: { xs: 'none', sm: 'block' },
                                mt: { xs: 0.25, sm: 0.5, md: 0.375, lg: 0.45, xl: 0.75 },
                              }}>
                                {shotList.sceneName || 'Scene'}
                              </Typography>
                            </Box>
                            {assignee ? (
                              <Tooltip title={assignee.name}>
                                <Avatar sx={{ 
                                  width: { xs: 18, sm: 20, md: 19, lg: 22, xl: 28 }, 
                                  height: { xs: 18, sm: 20, md: 19, lg: 22, xl: 28 }, 
                                  bgcolor: '#e91e63', 
                                  fontSize: { xs: 9, sm: 10, md: 9.5, lg: 11, xl: 14 }, 
                                  flexShrink: 0 
                                }}>
                                  {assignee.name.charAt(0)}
                                </Avatar>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Ikke tilordnet">
                                <Chip 
                                  label="Ledig" 
                                  size="small" 
                                  sx={{ 
                                    height: { xs: 16, sm: 18, md: 17, lg: 20, xl: 26 }, 
                                    fontSize: { xs: '0.5rem', sm: '0.55rem', md: '0.52rem', lg: '0.6rem', xl: '0.75rem' },
                                    bgcolor: 'rgba(255,152,0,0.15)',
                                    color: '#ff9800',
                                    border: '1px dashed rgba(255,152,0,0.4)',
                                    '& .MuiChip-label': { px: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.875, xl: 1.25 } },
                                    fontWeight: { xs: 500, sm: 400 },
                                  }} 
                                />
                              </Tooltip>
                            )}
                          </Box>
                          
                          <Box sx={{ flex: 1, display: 'flex', position: 'relative', minHeight: 36 }}>
                            {days.map((day, i) => {
                              const isToday = day.toDateString() === today.toDateString();
                              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                              return (
                                <Box 
                                  key={i}
                                  sx={{ 
                                    flex: 1, 
                                    minWidth: { xs: 40, sm: 45, md: 42, lg: 50, xl: 65 },
                                    borderRight: '1px solid rgba(255,255,255,0.03)',
                                    bgcolor: isToday ? 'rgba(233,30,99,0.05)' : isWeekend ? 'rgba(255,255,255,0.01)' : 'transparent',
                                  }}
                                />
                              );
                            })}
                            
                            <Tooltip title={`${shot.description || shot.shotType} - ${shot.estimatedTime || 60} min`}>
                              <Box
                                sx={{
                                  position: 'absolute',
                                  left: `calc(${barStart} * (100% / ${daysToShow}) + 4px)`,
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  width: `calc(${barLength} * (100% / ${daysToShow}) - 8px)`,
                                  height: { xs: 18, sm: 20, md: 19, lg: 22, xl: 28 },
                                  bgcolor: priority.color,
                                  borderRadius: { xs: 0.75, sm: 1, md: 0.875, lg: 1.1, xl: 1.5 },
                                  display: 'flex',
                                  alignItems: 'center',
                                  px: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.875, xl: 1.25 },
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  '&:hover': { 
                                    transform: 'translateY(-50%) scale(1.05)',
                                    boxShadow: `0 2px 12px ${priority.color}66`,
                                    zIndex: 1,
                                  },
                                }}
                              >
                                <Typography variant="caption" sx={{ 
                                  color: '#fff', 
                                  fontSize: { xs: '0.55rem', sm: '0.6rem', md: '0.58rem', lg: '0.65rem', xl: '0.8rem' }, 
                                  fontWeight: { xs: 600, sm: 500 },
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}>
                                  {shot.shotType}
                                </Typography>
                              </Box>
                            </Tooltip>
                          </Box>
                        </Box>
                      );
                    })
                  )}
                </Box>
                
                <Box sx={{ 
                  mt: { xs: 1, sm: 1.5, md: 2 }, 
                  p: { xs: 1, sm: 1.25, md: 1.5 }, 
                  bgcolor: 'rgba(255,255,255,0.02)', 
                  borderRadius: 1,
                  display: 'flex',
                  gap: { xs: 1, sm: 1.5, md: 2 },
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,152,0,0.8)', fontStyle: 'italic' }}>
                    * Estimert visning basert på status
                  </Typography>
                  <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    Prioritet:
                  </Typography>
                  {Object.entries(priorityConfig).map(([key, val]) => (
                    <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 12, height: 12, bgcolor: val.color, borderRadius: 0.5 }} />
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                        {val.label}
                      </Typography>
                    </Box>
                  ))}
                  <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    Status:
                  </Typography>
                  {statusColumns.map(col => (
                    <Box key={col.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, bgcolor: col.color, borderRadius: '50%' }} />
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                        {col.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })()}

          {viewMode === 'table' && (
              <Box sx={{ 
                p: { xs: 0.5, sm: 1, md: 0.75, lg: 1.25, xl: 2 }, 
                overflow: 'auto',
                maxWidth: '100%',
                height: '100%',
              }}>
                <Box
                  component="table"
                  sx={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    minWidth: { xs: 600, sm: 700, md: 750, lg: 850, xl: 1100 },
                    '& th, & td': {
                      p: { xs: 0.75, sm: 1, md: 0.875, lg: 1.25, xl: 2 },
                      textAlign: 'left',
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                    },
                    '& th': {
                      bgcolor: 'rgba(255,255,255,0.05)',
                      color: 'rgba(255,255,255,0.87)',
                      fontWeight: { xs: 600, sm: 600, md: 600 },
                      fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.75rem', lg: '0.82rem', xl: '1rem' },
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      whiteSpace: { xs: 'nowrap', sm: 'normal' },
                      py: { xs: 1, sm: 1.25, md: 1, lg: 1.25, xl: 2 },
                    },
                    '& td': {
                      color: '#fff',
                      fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.78rem', lg: '0.85rem', xl: '1rem' },
                      py: { xs: 0.75, sm: 1, md: 0.875, lg: 1.125, xl: 1.5 },
                    },
                  '& tbody tr:hover': {
                    bgcolor: 'rgba(255,255,255,0.03)',
                  },
                  '& tbody tr': {
                    transition: 'background-color 0.2s ease',
                  },
                }}
              >
                <thead>
                  <tr>
                    <th style={{ display: 'table-cell' }}>Beskrivelse</th>
                    <th style={{ display: window.innerWidth < 600 ? 'none' : 'table-cell' }}>Scene</th>
                    <th>Status</th>
                    <th>Prioritet</th>
                    <th>Tilordnet</th>
                    <th style={{ display: window.innerWidth < 960 ? 'none' : 'table-cell' }}>Tid</th>
                  </tr>
                </thead>
                <tbody>
                  {allShots.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
                        Ingen shots funnet
                      </td>
                    </tr>
                  ) : (
                    allShots.map(({ shot, shotList }) => {
                      const assignee = crewMembers.find(m => m.id === shot.assigneeId);
                      const priority = priorityConfig[shot.priority || 'important'];
                      const statusCol = statusColumns.find(s => s.id === (shot.status || 'not_started'));
                      return (
                        <tr key={shot.id}>
                          <td>
                            <Typography variant="body2" sx={{ 
                              fontWeight: 500,
                              fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.78rem', lg: '0.85rem', xl: '1rem' },
                            }}>
                              {shot.description || shot.shotType}
                            </Typography>
                          </td>
                          <td style={{ display: window.innerWidth < 600 ? 'none' : 'table-cell' }}>
                            <Typography variant="caption" sx={{ 
                              color: 'rgba(255,255,255,0.87)',
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '1rem' },
                            }}>
                              {shotList.sceneName || 'Scene'}
                            </Typography>
                          </td>
                          <td>
                            <Select
                              size="small"
                              value={shot.status || 'not_started'}
                              onChange={async (e) => {
                                if (onShotUpdate) {
                                  await onShotUpdate(shotList, { ...shot, status: e.target.value as ShotStatus });
                                }
                              }}
                              sx={{
                                minWidth: { xs: 90, sm: 110, md: 105, lg: 125, xl: 160 },
                                height: { xs: 32, sm: 36, md: 34, lg: 40, xl: 52 },
                                bgcolor: `${statusCol?.color}22`,
                                color: statusCol?.color,
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.82rem', xl: '1rem' },
                                '& .MuiSelect-select': { 
                                  py: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.875, xl: 1.25 }, 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 1,
                                  px: { xs: 0.75, sm: 1, md: 0.875, lg: 0.95, xl: 1.25 },
                                },
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: statusCol?.color },
                                '& .MuiSvgIcon-root': { color: statusCol?.color, fontSize: { xs: 18, sm: 20, md: 19, lg: 22, xl: 28 } },
                              }}
                            >
                              {statusColumns.map(col => (
                                <MenuItem key={col.id} value={col.id}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ color: col.color }}>{col.icon}</Box>
                                    <span>{col.label}</span>
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </td>
                          <td>
                            <Select
                              size="small"
                              value={shot.priority || 'important'}
                              onChange={async (e) => {
                                if (onShotUpdate) {
                                  await onShotUpdate(shotList, { ...shot, priority: e.target.value as ShotPriority });
                                }
                              }}
                              sx={{
                                minWidth: { xs: 80, sm: 90, md: 85, lg: 110, xl: 140 },
                                height: { xs: 32, sm: 36, md: 34, lg: 40, xl: 52 },
                                bgcolor: priority.bgColor,
                                color: priority.color,
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.82rem', xl: '1rem' },
                                '& .MuiSelect-select': { 
                                  py: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.875, xl: 1.25 },
                                  px: { xs: 0.75, sm: 1, md: 0.875, lg: 0.95, xl: 1.25 },
                                },
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: priority.color },
                                '& .MuiSvgIcon-root': { color: priority.color, fontSize: { xs: 18, sm: 20, md: 19, lg: 22, xl: 28 } },
                              }}
                            >
                              {Object.entries(priorityConfig).map(([key, val]) => (
                                <MenuItem key={key} value={key}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: val.color }}>
                                    {val.label}
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </td>
                          <td>
                            <Select
                              size="small"
                              value={shot.assigneeId || ''}
                              displayEmpty
                              onChange={async (e) => {
                                if (onShotUpdate) {
                                  const newAssigneeId = e.target.value || undefined;
                                  await onShotUpdate(shotList, { ...shot, assigneeId: newAssigneeId });
                                }
                              }}
                              sx={{
                                minWidth: { xs: 100, sm: 120, md: 115, lg: 135, xl: 170 },
                                height: { xs: 32, sm: 36, md: 34, lg: 40, xl: 52 },
                                bgcolor: assignee ? 'rgba(233,30,99,0.1)' : 'rgba(255,152,0,0.1)',
                                color: assignee ? '#e91e63' : '#ff9800',
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.82rem', xl: '1rem' },
                                '& .MuiSelect-select': { 
                                  py: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.875, xl: 1.25 }, 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 1,
                                  px: { xs: 0.75, sm: 1, md: 0.875, lg: 0.95, xl: 1.25 },
                                },
                                '& .MuiOutlinedInput-notchedOutline': { 
                                  borderColor: 'transparent',
                                  borderStyle: assignee ? 'solid' : 'dashed',
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: assignee ? '#e91e63' : '#ff9800' },
                                '& .MuiSvgIcon-root': { color: assignee ? '#e91e63' : '#ff9800', fontSize: { xs: 18, sm: 20, md: 19, lg: 22, xl: 28 } },
                              }}
                              renderValue={(selected) => {
                                if (!selected) return <span style={{ color: '#ff9800' }}>Ledig</span>;
                                const member = crewMembers.find(m => m.id === selected);
                                return (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Avatar sx={{ width: 20, height: 20, bgcolor: '#e91e63', fontSize: 10 }}>
                                      {member?.name.charAt(0)}
                                    </Avatar>
                                    <span>{member?.name}</span>
                                  </Box>
                                );
                              }}
                            >
                              <MenuItem value="">
                                <em style={{ color: '#ff9800' }}>Ledig</em>
                              </MenuItem>
                              {crewMembers.map(member => (
                                <MenuItem key={member.id} value={member.id}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Avatar sx={{ width: 20, height: 20, bgcolor: '#e91e63', fontSize: 10 }}>
                                      {member.name.charAt(0)}
                                    </Avatar>
                                    <span>{member.name}</span>
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </td>
                          <td>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                              {shot.estimatedTime ? `${shot.estimatedTime} min` : '-'}
                            </Typography>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Box>
            </Box>
          )}
        </Box>

        {showActivityPanel && (
          <Paper
            sx={{
              width: 320,
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              bgcolor: 'rgba(255,255,255,0.02)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
                Aktivitetslogg
              </Typography>
            </Box>
            <List sx={{ flex: 1, overflow: 'auto' }}>
              {activityLog.length === 0 ? (
                <ListItem>
                  <ListItemText
                    primary="Ingen aktivitet ennå"
                    sx={{ '& .MuiListItemText-primary': { color: 'rgba(255,255,255,0.87)' } }}
                  />
                </ListItem>
              ) : (
                activityLog.map(entry => (
                  <ListItem key={entry.id} sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <ListItemAvatar>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: '#e91e63', fontSize: 14 }}>
                        {entry.userName.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ color: '#fff' }}>
                          <strong>{entry.userName}</strong> endret status på "{entry.targetName}"
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                          {new Date(entry.timestamp).toLocaleString('nb-NO')}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Paper>
        )}
      </Box>

      {/* Call Sheet Drawer */}
      <Drawer
        anchor="right"
        open={showCallSheetDrawer}
        onClose={() => setShowCallSheetDrawer(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: '80%', md: '60%', lg: '50%' },
            maxWidth: 900,
            bgcolor: '#1a1f2e',
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            p: 2,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <CallSheetIcon sx={{ color: '#8b5cf6' }} />
              <Typography variant="h6" sx={{ color: '#fff' }}>
                Call Sheet fra Team Dashboard
              </Typography>
            </Stack>
            <IconButton onClick={() => setShowCallSheetDrawer(false)} sx={{ color: '#fff' }}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            <React.Suspense fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                <Typography color="text.secondary">Laster Call Sheet Generator...</Typography>
              </Box>
            }>
              {projectId && (
                <CallSheetGenerator
                  projectId={projectId}
                  productionDay={productionDay}
                  scenes={scenes}
                  crew={crewMembers}
                />
              )}
              {!projectId && (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="error" variant="body1">
                    Mangler prosjekt-ID. Call Sheet kan ikke genereres.
                  </Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
                    Åpne Team Dashboard fra et prosjekt for å bruke Call Sheet.
                  </Typography>
                </Box>
              )}
            </React.Suspense>
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
};

export default TeamDashboard;
