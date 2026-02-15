/**
 * CrewCalendarPanel - Modern crew scheduling calendar
 * 
 * Features:
 * - Mini calendar sidebar with date picker
 * - Week/Month/Day view toggle
 * - Department color-coded events
 * - Crew avatar quick-access
 * - Category filtering (departments)
 * - Drag-and-drop rescheduling
 * - Event detail popover
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Avatar,
  AvatarGroup,
  Checkbox,
  FormControlLabel,
  Button,
  ButtonGroup,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tab,
  Tabs,
  Badge,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemAvatar,
  Divider,
  alpha,
  useTheme,
  useMediaQuery,
  Drawer,
  SwipeableDrawer,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Add,
  ExpandMore,
  ExpandLess,
  AccessTime,
  Person,
  Group,
  CalendarMonth,
  Close,
  Star,
  StarBorder,
  Edit,
  Delete,
  Videocam,
  Lightbulb,
  CameraAlt,
  Mic,
  Brush,
  Face,
  TheaterComedy,
  Movie,
  Today,
  TrendingUp,
  Schedule,
  EventAvailable,
  FilterList,
  Search,
  MoreHoriz,
  Notifications,
  Settings,
  ViewWeek,
  ViewDay,
  ViewModule,
  PlayArrow,
  Assignment,
  LocationOn,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { LocalizationProvider, DateCalendar } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { nb } from 'date-fns/locale';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addDays,
  subDays,
  isSameDay,
  isSameMonth,
  isToday,
  isWeekend,
  setHours,
  setMinutes,
  getHours,
  getMinutes,
  getDay,
  parseISO,
} from 'date-fns';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type Department = 
  | 'regi'       // Direction
  | 'produksjon' // Production
  | 'kamera'     // Camera
  | 'lys'        // Lighting
  | 'grip'       // Grip
  | 'lyd'        // Sound
  | 'art'        // Art Department
  | 'hmu'        // Hair/Makeup
  | 'kostyme'    // Wardrobe
  | 'personal';  // Personal events

export type EventType = 
  | 'shooting'
  | 'rehearsal'
  | 'fitting'
  | 'meeting'
  | 'call'
  | 'wrap'
  | 'travel'
  | 'personal';

export interface CrewCalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: Date;
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  department: Department;
  eventType: EventType;
  crewIds: string[];
  locationName?: string;
  projectName?: string;
  color?: string;
  isAllDay?: boolean;
  reminders?: string[];
}

export interface CrewMemberBasic {
  id: string;
  name: string;
  role: string;
  department: Department;
  avatar?: string;
  email?: string;
  phone?: string;
}

export interface CalendarFilter {
  departments: Department[];
  crewIds: string[];
  eventTypes: EventType[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEPARTMENT_CONFIG: Record<Department, { label: string; color: string; icon: React.ReactNode }> = {
  regi: { label: 'Regi', color: '#9C27B0', icon: <Movie fontSize="small" /> },
  produksjon: { label: 'Produksjon', color: '#FF9800', icon: <TheaterComedy fontSize="small" /> },
  kamera: { label: 'Kamera', color: '#FFEB3B', icon: <CameraAlt fontSize="small" /> },
  lys: { label: 'Lys', color: '#4CAF50', icon: <Lightbulb fontSize="small" /> },
  grip: { label: 'Grip', color: '#795548', icon: <Videocam fontSize="small" /> },
  lyd: { label: 'Lyd', color: '#2196F3', icon: <Mic fontSize="small" /> },
  art: { label: 'Art', color: '#E91E63', icon: <Brush fontSize="small" /> },
  hmu: { label: 'HMU', color: '#FF4081', icon: <Face fontSize="small" /> },
  kostyme: { label: 'Kostyme', color: '#7C4DFF', icon: <Person fontSize="small" /> },
  personal: { label: 'Personlig', color: '#607D8B', icon: <Star fontSize="small" /> },
};

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; bgOpacity: number }> = {
  shooting: { label: 'Opptak', bgOpacity: 0.9 },
  rehearsal: { label: 'Prøve', bgOpacity: 0.7 },
  fitting: { label: 'Prøving', bgOpacity: 0.6 },
  meeting: { label: 'Møte', bgOpacity: 0.5 },
  call: { label: 'Call', bgOpacity: 0.8 },
  wrap: { label: 'Wrap', bgOpacity: 0.4 },
  travel: { label: 'Reise', bgOpacity: 0.3 },
  personal: { label: 'Personlig', bgOpacity: 0.5 },
};

const TIME_SLOTS = Array.from({ length: 14 }, (_, i) => i + 6); // 6:00 - 19:00

// ============================================================================
// GLASS STYLES
// ============================================================================

const glassStyles = {
  background: 'rgba(30, 30, 50, 0.85)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};

const glassLightStyles = {
  background: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(0, 0, 0, 0.05)',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
};

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_CREW: CrewMemberBasic[] = [
  { id: 'c1', name: 'Erik Nordmann', role: 'Regissør', department: 'regi', avatar: '' },
  { id: 'c2', name: 'Ingrid Solberg', role: 'Produsent', department: 'produksjon', avatar: '' },
  { id: 'c3', name: 'Lars Bakken', role: 'Fotograf', department: 'kamera', avatar: '' },
  { id: 'c4', name: 'Mette Holm', role: 'Gaffer', department: 'lys', avatar: '' },
  { id: 'c5', name: 'Anders Strand', role: 'Grip', department: 'grip', avatar: '' },
  { id: 'c6', name: 'Sara Nielsen', role: 'Lydtekniker', department: 'lyd', avatar: '' },
  { id: 'c7', name: 'Kristine Berg', role: 'Art Director', department: 'art', avatar: '' },
  { id: 'c8', name: 'Thomas Lund', role: 'Sminke', department: 'hmu', avatar: '' },
];

const generateMockEvents = (baseDate: Date): CrewCalendarEvent[] => {
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  
  return [
    {
      id: 'e1',
      title: 'Emails design',
      description: 'Design review for email templates',
      date: addDays(weekStart, 1), // Tuesday
      startTime: '09:00',
      endTime: '11:20',
      department: 'art',
      eventType: 'meeting',
      crewIds: ['c7', 'c2', 'c1'],
      projectName: 'Nordlys',
    },
    {
      id: 'e2',
      title: 'Youtube video',
      description: 'Behind the scenes shooting',
      date: addDays(weekStart, 1), // Tuesday
      startTime: '08:20',
      endTime: '09:40',
      department: 'kamera',
      eventType: 'shooting',
      crewIds: ['c3', 'c4'],
      projectName: 'BTS',
    },
    {
      id: 'e3',
      title: 'Designers meeting',
      description: 'Weekly sync',
      date: addDays(weekStart, 1), // Tuesday
      startTime: '09:50',
      endTime: '10:30',
      department: 'art',
      eventType: 'meeting',
      crewIds: ['c7'],
    },
    {
      id: 'e4',
      title: 'Brain storm',
      description: 'Creative session',
      date: addDays(weekStart, 2), // Wednesday
      startTime: '11:10',
      endTime: '12:50',
      department: 'regi',
      eventType: 'meeting',
      crewIds: ['c1', 'c2'],
      projectName: 'Nordlys',
    },
    {
      id: 'e5',
      title: 'UX meeting',
      description: 'UX review',
      date: addDays(weekStart, 2), // Wednesday
      startTime: '11:20',
      endTime: '16:00',
      department: 'produksjon',
      eventType: 'meeting',
      crewIds: ['c2'],
    },
    {
      id: 'e6',
      title: '(No Title)',
      description: '',
      date: addDays(weekStart, 3), // Thursday
      startTime: '08:00',
      endTime: '09:30',
      department: 'personal',
      eventType: 'personal',
      crewIds: [],
    },
    {
      id: 'e7',
      title: 'Breakfast',
      description: 'Team breakfast',
      date: addDays(weekStart, 3), // Thursday
      startTime: '09:30',
      endTime: '10:50',
      department: 'produksjon',
      eventType: 'meeting',
      crewIds: ['c2', 'c1'],
    },
    {
      id: 'e8',
      title: 'Team meeting',
      description: 'Weekly standup',
      date: addDays(weekStart, 3), // Thursday
      startTime: '11:00',
      endTime: '12:20',
      department: 'regi',
      eventType: 'meeting',
      crewIds: ['c1', 'c2', 'c3'],
    },
    {
      id: 'e9',
      title: 'Develop meeting',
      description: 'Tech sync',
      date: addDays(weekStart, 2), // Wednesday
      startTime: '12:10',
      endTime: '13:40',
      department: 'grip',
      eventType: 'meeting',
      crewIds: ['c5'],
    },
    {
      id: 'e10',
      title: 'Responsive Design',
      description: 'Design system review',
      date: addDays(weekStart, 3), // Thursday
      startTime: '08:00',
      endTime: '09:30',
      department: 'art',
      eventType: 'meeting',
      crewIds: ['c7'],
      projectName: 'Design System',
    },
    {
      id: 'e11',
      title: 'Landing Page',
      description: 'Landing page design',
      date: addDays(weekStart, 4), // Friday
      startTime: '08:00',
      endTime: '10:00',
      department: 'art',
      eventType: 'meeting',
      crewIds: ['c7'],
    },
    {
      id: 'e12',
      title: 'Launch Time',
      description: 'Product launch',
      date: addDays(weekStart, 4), // Friday
      startTime: '11:30',
      endTime: '12:40',
      department: 'produksjon',
      eventType: 'meeting',
      crewIds: ['c2', 'c1'],
    },
    {
      id: 'e13',
      title: 'UX meeting',
      description: 'UX follow-up',
      date: addDays(weekStart, 4), // Friday
      startTime: '12:00',
      endTime: '13:30',
      department: 'art',
      eventType: 'meeting',
      crewIds: ['c7'],
    },
    {
      id: 'e14',
      title: 'Designers meet',
      description: 'Design review',
      date: addDays(weekStart, 4), // Friday
      startTime: '12:50',
      endTime: '14:30',
      department: 'hmu',
      eventType: 'meeting',
      crewIds: ['c8'],
    },
    {
      id: 'e15',
      title: 'Study time',
      description: 'Learning session',
      date: addDays(weekStart, 5), // Saturday
      startTime: '08:00',
      endTime: '09:20',
      department: 'personal',
      eventType: 'personal',
      crewIds: [],
    },
    {
      id: 'e16',
      title: 'Motion design',
      description: 'Animation work',
      date: addDays(weekStart, 5), // Saturday
      startTime: '09:20',
      endTime: '10:30',
      department: 'art',
      eventType: 'meeting',
      crewIds: ['c7', 'c3'],
    },
    {
      id: 'e17',
      title: 'Design',
      description: 'Design work',
      date: addDays(weekStart, 5), // Saturday
      startTime: '10:30',
      endTime: '11:30',
      department: 'lys',
      eventType: 'meeting',
      crewIds: ['c4'],
    },
    {
      id: 'e18',
      title: 'New Project',
      description: 'Project kickoff',
      date: addDays(weekStart, 5), // Saturday
      startTime: '10:30',
      endTime: '12:10',
      department: 'regi',
      eventType: 'meeting',
      crewIds: ['c1', 'c2'],
    },
  ];
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface EventCardProps {
  event: CrewCalendarEvent;
  crew: CrewMemberBasic[];
  onClick: (event: CrewCalendarEvent) => void;
  compact?: boolean;
}

const EventCard: React.FC<EventCardProps> = ({ event, crew, onClick, compact }) => {
  const config = DEPARTMENT_CONFIG[event.department];
  const eventCrew = crew.filter(c => event.crewIds.includes(c.id));
  
  // Calculate height based on duration
  const [startHour, startMin] = event.startTime.split(':').map(Number);
  const [endHour, endMin] = event.endTime.split(':').map(Number);
  const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  const heightPx = Math.max((durationMinutes / 60) * 60, 44); // 60px per hour, min 44px
  
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02, zIndex: 20 }}
      onClick={() => onClick(event)}
      sx={{
        position: 'absolute',
        left: 4,
        right: 4,
        top: `${((startHour - 6) * 60 + startMin)}px`,
        height: `${heightPx}px`,
        background: `linear-gradient(135deg, ${alpha(config.color, 0.25)} 0%, ${alpha(config.color, 0.15)} 100%)`,
        borderLeft: `3px solid ${config.color}`,
        borderRadius: 1.5,
        p: 0.75,
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(4px)',
        boxShadow: `0 2px 8px ${alpha(config.color, 0.2)}`,
        '&:hover': {
          background: `linear-gradient(135deg, ${alpha(config.color, 0.35)} 0%, ${alpha(config.color, 0.25)} 100%)`,
          boxShadow: `0 4px 16px ${alpha(config.color, 0.35)}`,
        },
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          fontSize: compact ? '0.65rem' : '0.75rem',
          color: '#1a1a2e',
          display: 'block',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {event.title}
      </Typography>
      {!compact && heightPx > 50 && (
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.65rem',
            color: alpha('#1a1a2e', 0.7),
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mt: 0.25,
          }}
        >
          <AccessTime sx={{ fontSize: 10 }} />
          {event.startTime} - {event.endTime}
        </Typography>
      )}
      {!compact && heightPx > 70 && eventCrew.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.25, mt: 0.75 }}>
          {eventCrew.slice(0, 3).map((c) => (
            <Avatar
              key={c.id}
              sx={{
                width: 20,
                height: 20,
                fontSize: '0.55rem',
                fontWeight: 700,
                bgcolor: config.color,
                border: '1.5px solid white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              {c.name.charAt(0)}
            </Avatar>
          ))}
          {eventCrew.length > 3 && (
            <Avatar
              sx={{
                width: 20,
                height: 20,
                fontSize: '0.5rem',
                fontWeight: 700,
                bgcolor: alpha('#000', 0.5),
                border: '1.5px solid white',
              }}
            >
              +{eventCrew.length - 3}
            </Avatar>
          )}
        </Box>
      )}
    </Box>
  );
};

// ============================================================================
// EVENT DETAIL DIALOG
// ============================================================================

interface EventDetailDialogProps {
  event: CrewCalendarEvent | null;
  crew: CrewMemberBasic[];
  open: boolean;
  onClose: () => void;
  onEdit: (event: CrewCalendarEvent) => void;
  onDelete: (eventId: string) => void;
}

const EventDetailDialog: React.FC<EventDetailDialogProps> = ({
  event,
  crew,
  open,
  onClose,
  onEdit,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  
  if (!event) return null;
  
  const config = DEPARTMENT_CONFIG[event.department];
  const eventCrew = crew.filter(c => event.crewIds.includes(c.id));
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: 'background.paper',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {event.title}
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Prosjekter" sx={{ textTransform: 'none' }} />
          <Tab 
            label="Avtaler" 
            sx={{ 
              textTransform: 'none',
              '&.Mui-selected': { color: '#7C3AED' }
            }} 
          />
          <Tab label="Påminnelser" sx={{ textTransform: 'none' }} />
          <Tab label="Personlig" sx={{ textTransform: 'none' }} />
        </Tabs>
        
        {/* Event Info */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AccessTime fontSize="small" color="action" />
            <Typography variant="body2">
              {format(event.date, 'd. MMM yyyy', { locale: nb })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {event.startTime} - {event.endTime}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {config.icon}
            <Chip
              label={config.label}
              size="small"
              sx={{
                bgcolor: alpha(config.color, 0.2),
                color: config.color,
                fontWeight: 500,
              }}
            />
            <Chip
              label={EVENT_TYPE_CONFIG[event.eventType].label}
              size="small"
              variant="outlined"
            />
          </Box>
          
          {event.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {event.description}
            </Typography>
          )}
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Crew Section */}
        <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Group fontSize="small" />
          Legg til lagkamerater
        </Typography>
        
        <List dense sx={{ bgcolor: 'background.default', borderRadius: 2 }}>
          {eventCrew.map((member) => (
            <ListItem
              key={member.id}
              secondaryAction={
                <IconButton size="small">
                  <Close fontSize="small" />
                </IconButton>
              }
            >
              <ListItemAvatar>
                <Avatar sx={{ width: 32, height: 32, bgcolor: config.color }}>
                  {member.name.charAt(0)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={member.name}
                secondary={format(event.date, 'd. MMM yyyy', { locale: nb })}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          startIcon={<Delete />}
          color="error"
          onClick={() => onDelete(event.id)}
        >
          Slett
        </Button>
        <Button
          startIcon={<Edit />}
          variant="contained"
          onClick={() => onEdit(event)}
        >
          Rediger
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// CREATE/EDIT EVENT DIALOG
// ============================================================================

interface EventFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (event: Partial<CrewCalendarEvent>) => void;
  event?: CrewCalendarEvent | null;
  crew: CrewMemberBasic[];
  defaultDate?: Date;
  defaultHour?: number;
}

const EventFormDialog: React.FC<EventFormDialogProps> = ({
  open,
  onClose,
  onSave,
  event,
  crew,
  defaultDate,
  defaultHour,
}) => {
  const isEditing = !!event;
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [department, setDepartment] = useState<Department>(event?.department || 'produksjon');
  const [eventType, setEventType] = useState<EventType>(event?.eventType || 'meeting');
  const [startTime, setStartTime] = useState(event?.startTime || `${(defaultHour || 9).toString().padStart(2, '0')}:00`);
  const [endTime, setEndTime] = useState(event?.endTime || `${((defaultHour || 9) + 1).toString().padStart(2, '0')}:00`);
  const [selectedCrew, setSelectedCrew] = useState<string[]>(event?.crewIds || []);
  const [locationName, setLocationName] = useState(event?.locationName || '');
  
  // Reset form when event changes
  React.useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setDepartment(event.department);
      setEventType(event.eventType);
      setStartTime(event.startTime);
      setEndTime(event.endTime);
      setSelectedCrew(event.crewIds);
      setLocationName(event.locationName || '');
    } else {
      setTitle('');
      setDescription('');
      setDepartment('produksjon');
      setEventType('meeting');
      setStartTime(`${(defaultHour || 9).toString().padStart(2, '0')}:00`);
      setEndTime(`${((defaultHour || 9) + 1).toString().padStart(2, '0')}:00`);
      setSelectedCrew([]);
      setLocationName('');
    }
  }, [event, defaultHour, open]);
  
  const handleSave = () => {
    onSave({
      ...(event || {}),
      title: title || 'Ny hendelse',
      description,
      department,
      eventType,
      startTime,
      endTime,
      crewIds: selectedCrew,
      locationName,
      date: event?.date || defaultDate || new Date(),
    });
  };
  
  const toggleCrewMember = (crewId: string) => {
    setSelectedCrew(prev => 
      prev.includes(crewId) 
        ? prev.filter(id => id !== crewId)
        : [...prev, crewId]
    );
  };
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 },
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {isEditing ? <Edit color="primary" /> : <Add color="primary" />}
          <Typography variant="h6" fontWeight={600}>
            {isEditing ? 'Rediger Hendelse' : 'Ny Hendelse'}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            label="Tittel"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Skriv inn hendelsens tittel..."
            autoFocus
          />
          
          <TextField
            label="Beskrivelse"
            fullWidth
            multiline
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Valgfri beskrivelse..."
          />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Avdeling</InputLabel>
              <Select
                value={department}
                label="Avdeling"
                onChange={(e) => setDepartment(e.target.value as Department)}
                MenuProps={{ sx: { zIndex: 1400 } }}
              >
                {(Object.entries(DEPARTMENT_CONFIG) as [Department, typeof DEPARTMENT_CONFIG[Department]][]).map(([key, config]) => (
                  <MenuItem key={key} value={key}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: '50%', 
                        bgcolor: config.color 
                      }} />
                      {config.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={eventType}
                label="Type"
                onChange={(e) => setEventType(e.target.value as EventType)}
                MenuProps={{ sx: { zIndex: 1400 } }}
              >
                {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, typeof EVENT_TYPE_CONFIG[EventType]][]).map(([key, config]) => (
                  <MenuItem key={key} value={key}>{config.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start"
              type="time"
              size="small"
              fullWidth
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Slutt"
              type="time"
              size="small"
              fullWidth
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
          
          <TextField
            label="Lokasjon"
            fullWidth
            size="small"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Valgfri lokasjon..."
            slotProps={{
              input: {
                startAdornment: <LocationOn sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />,
              },
            }}
          />
          
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Crew ({selectedCrew.length} valgt)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {crew.map((member) => {
                const isSelected = selectedCrew.includes(member.id);
                const config = DEPARTMENT_CONFIG[member.department];
                return (
                  <Chip
                    key={member.id}
                    label={member.name}
                    size="small"
                    onClick={() => toggleCrewMember(member.id)}
                    avatar={
                      <Avatar sx={{ bgcolor: config.color, width: 24, height: 24 }}>
                        {member.name.charAt(0)}
                      </Avatar>
                    }
                    sx={{
                      border: isSelected ? `2px solid ${config.color}` : '2px solid transparent',
                      bgcolor: isSelected ? alpha(config.color, 0.15) : 'transparent',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: alpha(config.color, 0.1),
                      },
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} color="inherit">
          Avbryt
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          startIcon={isEditing ? <Edit /> : <Add />}
          disabled={!title.trim()}
        >
          {isEditing ? 'Lagre Endringer' : 'Opprett Hendelse'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// SEARCH DIALOG
// ============================================================================

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  events: CrewCalendarEvent[];
  onEventClick: (event: CrewCalendarEvent) => void;
}

const SearchDialog: React.FC<SearchDialogProps> = ({
  open,
  onClose,
  searchQuery,
  onSearchChange,
  events,
  onEventClick,
}) => {
  const filteredEvents = searchQuery.trim()
    ? events.filter(e =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.projectName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : events.slice(0, 5);
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <TextField
          fullWidth
          placeholder="Søk etter hendelser..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          autoFocus
          slotProps={{
            input: {
              startAdornment: <Search sx={{ color: 'text.secondary', mr: 1 }} />,
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
        />
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        {filteredEvents.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            Ingen hendelser funnet
          </Typography>
        ) : (
          <List>
            {filteredEvents.map((event) => {
              const config = DEPARTMENT_CONFIG[event.department];
              return (
                <ListItem
                  key={event.id}
                  component="div"
                  onClick={() => {
                    onEventClick(event);
                    onClose();
                  }}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: alpha(config.color, 0.08) },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: config.color,
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={event.title}
                    secondary={`${format(event.date, 'd. MMM', { locale: nb })} • ${event.startTime} - ${event.endTime}`}
                    primaryTypographyProps={{ fontWeight: 500 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <Chip
                    label={config.label}
                    size="small"
                    sx={{
                      bgcolor: alpha(config.color, 0.15),
                      color: config.color,
                      fontWeight: 600,
                      fontSize: '0.65rem',
                    }}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface CrewCalendarPanelProps {
  projectId?: string;
  projectName?: string;
  initialDate?: Date;
  crew?: CrewMemberBasic[];
  events?: CrewCalendarEvent[];
  onEventCreate?: (event: Partial<CrewCalendarEvent>) => void;
  onEventUpdate?: (event: CrewCalendarEvent) => void;
  onEventDelete?: (eventId: string) => void;
}

export const CrewCalendarPanel: React.FC<CrewCalendarPanelProps> = ({
  projectId,
  projectName,
  initialDate = new Date(),
  crew: propCrew,
  events: propEvents,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
}) => {
  const theme = useTheme();
  
  // Responsive breakpoints
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // < 600px
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600px - 900px
  const isDesktop = useMediaQuery(theme.breakpoints.up('md')); // > 900px
  const isLargeDesktop = useMediaQuery(theme.breakpoints.up('lg')); // > 1200px
  
  // Mobile sidebar drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  
  // State - use props if provided, otherwise fall back to mock data
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [viewMode, setViewMode] = useState<'Month' | 'week' | 'Day'>('week');
  const [events, setEvents] = useState<CrewCalendarEvent[]>(() => 
    propEvents && propEvents.length > 0 ? propEvents : generateMockEvents(initialDate)
  );
  const [crew] = useState<CrewMemberBasic[]>(() => 
    propCrew && propCrew.length > 0 ? propCrew : MOCK_CREW
  );
  const [selectedEvent, setSelectedEvent] = useState<CrewCalendarEvent | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CrewCalendarEvent | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ day: Date; hour: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  // Filters
  const [enabledDepartments, setEnabledDepartments] = useState<Set<Department>>(
    new Set(Object.keys(DEPARTMENT_CONFIG) as Department[])
  );
  const [favoriteCrew, setFavoriteCrew] = useState<Set<string>>(new Set(['c1', 'c2', 'c3']));
  const [expandedSections, setExpandedSections] = useState({
    calendars: true,
    favorites: true,
    categories: true,
  });
  
  // Computed
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);
  
  const filteredEvents = useMemo(() => {
    return events.filter(e => enabledDepartments.has(e.department));
  }, [events, enabledDepartments]);
  
  const getEventsForDay = useCallback((day: Date) => {
    return filteredEvents.filter(e => isSameDay(e.date, day));
  }, [filteredEvents]);
  
  // Handlers - navigate based on view mode
  const handlePrevWeek = () => {
    if (viewMode === 'Month') {
      setSelectedDate(prev => subMonths(prev, 1));
    } else if (viewMode === 'Day') {
      setSelectedDate(prev => subDays(prev, 1));
    } else {
      setSelectedDate(prev => subWeeks(prev, 1));
    }
  };
  const handleNextWeek = () => {
    if (viewMode === 'Month') {
      setSelectedDate(prev => addMonths(prev, 1));
    } else if (viewMode === 'Day') {
      setSelectedDate(prev => addDays(prev, 1));
    } else {
      setSelectedDate(prev => addWeeks(prev, 1));
    }
  };
  const handleToday = () => setSelectedDate(new Date());
  
  // Month view days calculation
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [selectedDate]);
  
  const toggleDepartment = (dept: Department) => {
    setEnabledDepartments(prev => {
      const next = new Set(prev);
      if (next.has(dept)) {
        next.delete(dept);
      } else {
        next.add(dept);
      }
      return next;
    });
  };
  
  const toggleFavorite = (crewId: string) => {
    setFavoriteCrew(prev => {
      const next = new Set(prev);
      if (next.has(crewId)) {
        next.delete(crewId);
      } else {
        next.add(crewId);
      }
      return next;
    });
  };
  
  const handleEventClick = (event: CrewCalendarEvent) => {
    setSelectedEvent(event);
    setDetailDialogOpen(true);
  };
  
  const handleEventDelete = (eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
    setDetailDialogOpen(false);
    onEventDelete?.(eventId);
  };
  
  const handleEventEdit = (event: CrewCalendarEvent) => {
    setEditingEvent(event);
    setDetailDialogOpen(false);
    setCreateDialogOpen(true);
  };
  
  const handleEventUpdate = (updatedEvent: CrewCalendarEvent) => {
    setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
    setCreateDialogOpen(false);
    setEditingEvent(null);
    onEventUpdate?.(updatedEvent);
  };
  
  const handleCreateEvent = (newEvent: Partial<CrewCalendarEvent>) => {
    const fullEvent: CrewCalendarEvent = {
      id: `e${Date.now()}`,
      title: newEvent.title || 'Ny hendelse',
      description: newEvent.description || '',
      date: newEvent.date || selectedTimeSlot?.day || selectedDate,
      startTime: newEvent.startTime || `${selectedTimeSlot?.hour?.toString().padStart(2, '0') || '09'}:00`,
      endTime: newEvent.endTime || `${((selectedTimeSlot?.hour || 9) + 1).toString().padStart(2, '0')}:00`,
      department: newEvent.department || 'produksjon',
      eventType: newEvent.eventType || 'meeting',
      crewIds: newEvent.crewIds || [],
      ...newEvent,
    };
    setEvents(prev => [...prev, fullEvent]);
    setCreateDialogOpen(false);
    setSelectedTimeSlot(null);
    onEventCreate?.(fullEvent);
  };
  
  const handleTimeSlotClick = (day: Date, hour: number) => {
    setSelectedTimeSlot({ day, hour });
    setEditingEvent(null);
    setCreateDialogOpen(true);
  };
  
  const handleAddCrewMember = () => {
    // TODO: Open crew selection dialog or navigate to crew management
    console.log('Add crew member clicked');
  };
  
  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) return filteredEvents;
    const query = searchQuery.toLowerCase();
    return filteredEvents.filter(e => 
      e.title.toLowerCase().includes(query) ||
      e.description?.toLowerCase().includes(query) ||
      e.projectName?.toLowerCase().includes(query)
    );
  }, [filteredEvents, searchQuery]);
  
  // Gradient background
  const gradientBg = `linear-gradient(135deg, 
    ${alpha('#E8F5E9', 0.5)} 0%, 
    ${alpha('#E3F2FD', 0.5)} 25%, 
    ${alpha('#FFF3E0', 0.5)} 50%, 
    ${alpha('#FCE4EC', 0.5)} 75%, 
    ${alpha('#F3E5F5', 0.5)} 100%
  )`;
  
  // Stats calculation
  const todayEvents = events.filter(e => isToday(e.date)).length;
  const weekEvents = filteredEvents.length;
  const crewOnDuty = new Set(filteredEvents.flatMap(e => e.crewIds)).size;
  
  // Sidebar content - extracted for reuse in drawer
  const SidebarContent = (
    <>
      {/* Header */}
      <Box sx={{ p: isMobile ? 2 : 2.5, borderBottom: `1px solid ${alpha('#fff', 0.08)}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: isMobile ? 36 : 42,
                height: isMobile ? 36 : 42,
                borderRadius: 2.5,
                background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(124, 58, 237, 0.4)',
              }}
            >
              <CalendarMonth sx={{ color: '#fff', fontSize: isMobile ? 18 : 22 }} />
            </Box>
            <Box>
              <Typography variant={isMobile ? 'body1' : 'subtitle1'} sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>
                Crew Kalender
              </Typography>
              <Typography variant="caption" sx={{ color: alpha('#fff', 0.5) }}>
                {projectName || 'Alle prosjekter'}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isMobile && (
              <IconButton 
                size="small" 
                onClick={() => setMobileDrawerOpen(false)}
                sx={{ color: alpha('#fff', 0.5), '&:hover': { color: '#fff' } }}
              >
                <Close fontSize="small" />
              </IconButton>
            )}
            <IconButton 
              size="small" 
              onClick={() => setSettingsOpen(true)}
              sx={{ color: alpha('#fff', 0.5), '&:hover': { color: '#fff' } }}
            >
              <Settings fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        
        {/* Add Event Button */}
        <Button
          fullWidth
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setEditingEvent(null);
            setSelectedTimeSlot(null);
            setCreateDialogOpen(true);
            if (isMobile) setMobileDrawerOpen(false);
          }}
          sx={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
            borderRadius: 2,
            py: isMobile ? 1 : 1.25,
            fontWeight: 600,
            fontSize: isMobile ? '0.85rem' : '0.875rem',
            boxShadow: '0 4px 16px rgba(124, 58, 237, 0.3)',
            '&:hover': {
              background: 'linear-gradient(135deg, #6D28D9 0%, #9333EA 100%)',
              boxShadow: '0 6px 20px rgba(124, 58, 237, 0.4)',
            },
          }}
        >
          Ny Hendelse
        </Button>
      </Box>
      
      {/* Quick Stats */}
      <Box sx={{ px: isMobile ? 2 : 2.5, py: 2, borderBottom: `1px solid ${alpha('#fff', 0.05)}` }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? 1 : 1.5 }}>
          {[
            { label: 'I dag', value: todayEvents, color: '#10B981' },
            { label: 'Denne uken', value: weekEvents, color: '#7C3AED' },
            { label: 'Crew', value: crewOnDuty, color: '#F59E0B' },
          ].map((stat) => (
            <Box
              key={stat.label}
              sx={{
                textAlign: 'center',
                p: isMobile ? 1 : 1.5,
                borderRadius: 2,
                bgcolor: alpha(stat.color, 0.1),
                border: `1px solid ${alpha(stat.color, 0.2)}`,
              }}
            >
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ color: stat.color, fontWeight: 700 }}>
                {stat.value}
              </Typography>
              <Typography variant="caption" sx={{ color: alpha('#fff', 0.5), fontSize: isMobile ? '0.6rem' : '0.65rem' }}>
                {stat.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
      
      {/* Mini Calendar */}
      <Box sx={{ px: isMobile ? 1 : 2, py: 1 }}>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={nb}>
          <DateCalendar
            value={selectedDate}
            onChange={(newDate) => {
              if (newDate) {
                setSelectedDate(newDate);
                if (isMobile) setMobileDrawerOpen(false);
              }
            }}
            sx={{
              width: '100%',
              '& .MuiPickersCalendarHeader-root': {
                color: '#fff',
                '& .MuiPickersArrowSwitcher-button': { color: alpha('#fff', 0.7) },
                '& .MuiPickersCalendarHeader-label': { color: '#fff', fontWeight: 600, fontSize: isMobile ? '0.85rem' : '0.9rem' },
              },
              '& .MuiDayCalendar-weekDayLabel': { color: alpha('#fff', 0.5), fontSize: isMobile ? '0.65rem' : '0.7rem' },
              '& .MuiPickersDay-root': {
                color: '#fff',
                fontSize: isMobile ? '0.75rem' : '0.8rem',
                '&:hover': { bgcolor: alpha('#7C3AED', 0.2) },
                '&.Mui-selected': {
                  bgcolor: '#7C3AED',
                  '&:hover': { bgcolor: '#6D28D9' },
                },
                '&.MuiPickersDay-today': {
                  border: '1px solid #7C3AED',
                },
              },
            }}
          />
        </LocalizationProvider>
      </Box>
      
      {/* Calendars Section */}
      <Box sx={{ flex: 1, overflow: 'auto', px: isMobile ? 2 : 2.5, py: 1 }}>
        <Box
          onClick={() => setExpandedSections(s => ({ ...s, calendars: !s.calendars }))}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            py: 1,
          }}
        >
          <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
            Mine Kalendere
          </Typography>
          {expandedSections.calendars ? (
            <ExpandLess sx={{ color: 'grey.500' }} />
          ) : (
            <ChevronRight sx={{ color: 'grey.500' }} />
          )}
        </Box>
        <Collapse in={expandedSections.calendars}>
          <Box sx={{ pl: 1 }}>
            {(Object.entries(DEPARTMENT_CONFIG) as [Department, typeof DEPARTMENT_CONFIG[Department]][])
              .slice(0, 5)
              .map(([dept, config]) => (
                <FormControlLabel
                  key={dept}
                  control={
                    <Checkbox
                      size="small"
                      checked={enabledDepartments.has(dept)}
                      onChange={() => toggleDepartment(dept)}
                      sx={{
                        color: config.color,
                        '&.Mui-checked': { color: config.color },
                        padding: isMobile ? '4px' : '8px',
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ color: 'grey.300', fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
                      {config.label}
                    </Typography>
                  }
                />
              ))}
          </Box>
        </Collapse>
        
        {/* Favorites */}
        <Box
          onClick={() => setExpandedSections(s => ({ ...s, favorites: !s.favorites }))}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            py: 1,
            mt: 1,
          }}
        >
          <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
            Favoritter
          </Typography>
          {expandedSections.favorites ? (
            <ExpandLess sx={{ color: 'grey.500' }} />
          ) : (
            <ChevronRight sx={{ color: 'grey.500' }} />
          )}
        </Box>
        
        {/* Categories (Departments) */}
        <Box
          onClick={() => setExpandedSections(s => ({ ...s, categories: !s.categories }))}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            py: 1,
            mt: 1,
          }}
        >
          <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
            Avdelinger
          </Typography>
          {expandedSections.categories ? (
            <ExpandLess sx={{ color: 'grey.500' }} />
          ) : (
            <ExpandMore sx={{ color: 'grey.500' }} />
          )}
        </Box>
        <Collapse in={expandedSections.categories}>
          <Box sx={{ pl: 1 }}>
            {(Object.entries(DEPARTMENT_CONFIG) as [Department, typeof DEPARTMENT_CONFIG[Department]][])
              .slice(0, 5)
              .map(([dept, config]) => (
                <FormControlLabel
                  key={dept}
                  control={
                    <Checkbox
                      size="small"
                      checked={enabledDepartments.has(dept)}
                      onChange={() => toggleDepartment(dept)}
                      sx={{
                        color: config.color,
                        '&.Mui-checked': { color: config.color },
                        padding: isMobile ? '4px' : '8px',
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ color: 'grey.300', fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
                      {config.label}
                    </Typography>
                  }
                />
              ))}
          </Box>
        </Collapse>
      </Box>
      
      {/* Bottom Crew Avatars */}
      <Box sx={{ p: isMobile ? 2 : 2.5, borderTop: `1px solid ${alpha('#fff', 0.08)}`, mt: 'auto' }}>
        <Typography variant="caption" sx={{ color: alpha('#fff', 0.4), fontWeight: 600, fontSize: '0.6rem', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
          TEAM OVERSIKT
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {crew.slice(0, isMobile ? 5 : 6).map((member) => (
            <Tooltip key={member.id} title={member.name}>
              <Avatar
                sx={{
                  width: isMobile ? 24 : 28,
                  height: isMobile ? 24 : 28,
                  bgcolor: DEPARTMENT_CONFIG[member.department].color,
                  fontSize: isMobile ? '0.6rem' : '0.65rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  '&:hover': { transform: 'scale(1.1)' },
                  transition: 'transform 0.2s ease',
                }}
              >
                {member.name.charAt(0)}
              </Avatar>
            </Tooltip>
          ))}
        </Box>
      </Box>
    </>
  );
  
  return (
    <Box 
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      sx={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        height: '100%', 
        minHeight: isMobile ? 500 : 700, 
        bgcolor: '#0f0f1a' 
      }}
    >
      {/* ================================================================== */}
      {/* MOBILE DRAWER SIDEBAR */}
      {/* ================================================================== */}
      {(isMobile || isTablet) && (
        <SwipeableDrawer
          anchor="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          onOpen={() => setMobileDrawerOpen(true)}
          PaperProps={{
            sx: {
              width: isMobile ? '85%' : 320,
              maxWidth: 320,
              ...glassStyles,
              borderRight: 'none',
            },
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {SidebarContent}
          </Box>
        </SwipeableDrawer>
      )}
      
      {/* ================================================================== */}
      {/* DESKTOP SIDEBAR */}
      {/* ================================================================== */}
      {isDesktop && (
        <Box
          component={motion.div}
          initial={{ x: -280 }}
          animate={{ x: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          sx={{
            width: isLargeDesktop ? 300 : 280,
            flexShrink: 0,
            ...glassStyles,
            borderRight: 'none',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            m: 2,
            ml: 2,
            mr: 0,
            borderRadius: 3,
          }}
        >
          {SidebarContent}
        </Box>
      )}
      
      {/* ================================================================== */}
      {/* MAIN CALENDAR AREA */}
      {/* ================================================================== */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          m: isMobile ? 1 : 2,
          ml: isMobile ? 1 : (isDesktop ? 1 : 2),
          borderRadius: isMobile ? 2 : 3,
          overflow: 'hidden',
          ...glassLightStyles,
        }}
      >
        {/* Header */}
        <Box
          component={motion.div}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: isMobile ? 'wrap' : 'nowrap',
            gap: isMobile ? 1 : 0,
            px: isMobile ? 2 : 3,
            py: isMobile ? 1.5 : 2,
            borderBottom: `1px solid ${alpha('#000', 0.06)}`,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 1 : 2, width: isMobile ? '100%' : 'auto' }}>
            {/* Mobile menu button */}
            {(isMobile || isTablet) && (
              <IconButton 
                size="small" 
                onClick={() => setMobileDrawerOpen(true)}
                sx={{ 
                  bgcolor: alpha('#7C3AED', 0.1),
                  color: '#7C3AED',
                  border: `1px solid ${alpha('#7C3AED', 0.2)}`,
                  '&:hover': { 
                    bgcolor: alpha('#7C3AED', 0.2),
                  },
                }}
              >
                <MenuIcon fontSize="small" />
              </IconButton>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton 
                size="small" 
                onClick={handlePrevWeek}
                sx={{ 
                  bgcolor: alpha('#1a1a2e', 0.08),
                  color: '#1a1a2e',
                  border: `1px solid ${alpha('#1a1a2e', 0.12)}`,
                  '&:hover': { 
                    bgcolor: alpha('#7C3AED', 0.15),
                    color: '#7C3AED',
                    borderColor: alpha('#7C3AED', 0.3),
                  },
                }}
              >
                <ChevronLeft />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={handleNextWeek}
                sx={{ 
                  bgcolor: alpha('#1a1a2e', 0.08),
                  color: '#1a1a2e',
                  border: `1px solid ${alpha('#1a1a2e', 0.12)}`,
                  '&:hover': { 
                    bgcolor: alpha('#7C3AED', 0.15),
                    color: '#7C3AED',
                    borderColor: alpha('#7C3AED', 0.3),
                  },
                }}
              >
                <ChevronRight />
              </IconButton>
            </Box>
            <Typography 
              variant={isMobile ? 'subtitle1' : 'h5'} 
              sx={{ 
                fontWeight: 700, 
                color: '#1a1a2e', 
                letterSpacing: '-0.02em',
                fontSize: isMobile ? '1rem' : undefined,
              }}
            >
              {format(selectedDate, isMobile ? 'MMM yyyy' : 'MMMM yyyy', { locale: nb })}
            </Typography>
            {!isMobile && (
              <Chip
                label="I dag"
                size="small"
                onClick={handleToday}
                icon={<Today sx={{ fontSize: 16 }} />}
                sx={{
                  bgcolor: alpha('#10B981', 0.1),
                  color: '#10B981',
                  fontWeight: 600,
                  border: `1px solid ${alpha('#10B981', 0.3)}`,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: alpha('#10B981', 0.2) },
                }}
              />
            )}
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.5 : 1.5, ml: isMobile ? 'auto' : 0 }}>
            {/* Mobile: Today button */}
            {isMobile && (
              <IconButton 
                size="small" 
                onClick={handleToday}
                sx={{ 
                  bgcolor: alpha('#10B981', 0.1),
                  color: '#10B981',
                  border: `1px solid ${alpha('#10B981', 0.3)}`,
                  '&:hover': { bgcolor: alpha('#10B981', 0.2) },
                }}
              >
                <Today fontSize="small" />
              </IconButton>
            )}
            
            {/* Search */}
            <IconButton 
              size="small" 
              onClick={() => setSearchOpen(true)}
              sx={{ 
                bgcolor: alpha('#1a1a2e', 0.08),
                color: '#1a1a2e',
                border: `1px solid ${alpha('#1a1a2e', 0.12)}`,
                '&:hover': { 
                  bgcolor: alpha('#7C3AED', 0.15),
                  color: '#7C3AED',
                  borderColor: alpha('#7C3AED', 0.3),
                },
              }}
            >
              <Search fontSize="small" />
            </IconButton>
            
            {/* Filter */}
            <IconButton 
              size="small" 
              onClick={() => setFilterDialogOpen(true)}
              sx={{ 
                bgcolor: enabledDepartments.size < Object.keys(DEPARTMENT_CONFIG).length 
                  ? alpha('#7C3AED', 0.15) 
                  : alpha('#1a1a2e', 0.08),
                color: enabledDepartments.size < Object.keys(DEPARTMENT_CONFIG).length 
                  ? '#7C3AED' 
                  : '#1a1a2e',
                border: `1px solid ${enabledDepartments.size < Object.keys(DEPARTMENT_CONFIG).length 
                  ? alpha('#7C3AED', 0.3) 
                  : alpha('#1a1a2e', 0.12)}`,
                '&:hover': { 
                  bgcolor: alpha('#7C3AED', 0.15),
                  color: '#7C3AED',
                  borderColor: alpha('#7C3AED', 0.3),
                },
              }}
            >
              <Badge 
                badgeContent={Object.keys(DEPARTMENT_CONFIG).length - enabledDepartments.size} 
                color="primary"
                invisible={enabledDepartments.size === Object.keys(DEPARTMENT_CONFIG).length}
              >
                <FilterList fontSize="small" />
              </Badge>
            </IconButton>
            
            {/* View Mode Toggle - Hidden on very small screens */}
            {!isMobile && (
              <Box 
                sx={{ 
                  display: 'flex',
                  bgcolor: alpha('#000', 0.04),
                  borderRadius: 2,
                  p: 0.5,
                }}
              >
                {[
                  { mode: 'Day' as const, icon: <ViewDay fontSize="small" />, label: 'Dag' },
                  { mode: 'week' as const, icon: <ViewWeek fontSize="small" />, label: 'Uke' },
                  { mode: 'Month' as const, icon: <ViewModule fontSize="small" />, label: 'Måned' },
                ].map((item) => (
                  <Tooltip key={item.mode} title={item.label}>
                    <IconButton
                      size="small"
                      onClick={() => setViewMode(item.mode)}
                      sx={{
                        borderRadius: 1.5,
                        color: viewMode === item.mode ? '#fff' : alpha('#000', 0.5),
                        bgcolor: viewMode === item.mode ? '#7C3AED' : 'transparent',
                        '&:hover': { 
                          bgcolor: viewMode === item.mode ? '#6D28D9' : alpha('#000', 0.08),
                        },
                      }}
                    >
                      {item.icon}
                    </IconButton>
                  </Tooltip>
                ))}
              </Box>
            )}
            
            {/* Notifications */}
            <IconButton 
              size="small" 
              onClick={() => setNotificationsOpen(true)}
              sx={{ 
                bgcolor: todayEvents > 0 ? alpha('#EF4444', 0.1) : alpha('#1a1a2e', 0.08),
                color: todayEvents > 0 ? '#EF4444' : '#1a1a2e',
                border: `1px solid ${todayEvents > 0 ? alpha('#EF4444', 0.3) : alpha('#1a1a2e', 0.12)}`,
                '&:hover': { 
                  bgcolor: alpha('#EF4444', 0.15),
                  color: '#EF4444',
                  borderColor: alpha('#EF4444', 0.3),
                },
              }}
            >
              <Badge badgeContent={todayEvents} color="error" max={9}>
                <Notifications fontSize="small" />
              </Badge>
            </IconButton>
          </Box>
        </Box>
        
        {/* Mobile View Mode Toggle - Full width row */}
        {isMobile && (
          <Box 
            sx={{ 
              display: 'flex',
              justifyContent: 'center',
              gap: 1,
              p: 1,
              borderBottom: `1px solid ${alpha('#000', 0.06)}`,
              bgcolor: alpha('#f8f9fa', 0.3),
            }}
          >
            {[
              { mode: 'Day' as const, icon: <ViewDay fontSize="small" />, label: 'Dag' },
              { mode: 'week' as const, icon: <ViewWeek fontSize="small" />, label: 'Uke' },
              { mode: 'Month' as const, icon: <ViewModule fontSize="small" />, label: 'Måned' },
            ].map((item) => (
              <Chip
                key={item.mode}
                label={item.label}
                icon={item.icon}
                onClick={() => setViewMode(item.mode)}
                size="small"
                sx={{
                  bgcolor: viewMode === item.mode ? '#7C3AED' : alpha('#000', 0.04),
                  color: viewMode === item.mode ? '#fff' : alpha('#000', 0.7),
                  fontWeight: 600,
                  '& .MuiChip-icon': {
                    color: viewMode === item.mode ? '#fff' : alpha('#000', 0.5),
                  },
                  '&:hover': { 
                    bgcolor: viewMode === item.mode ? '#6D28D9' : alpha('#000', 0.08),
                  },
                }}
              />
            ))}
          </Box>
        )}
        
        {/* Week Header - Only shown in week view */}
        {viewMode === 'week' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '50px repeat(7, 1fr)' : '70px repeat(7, 1fr)',
            borderBottom: `1px solid ${alpha('#000', 0.06)}`,
            bgcolor: alpha('#f8f9fa', 0.5),
          }}
        >
          <Box sx={{ p: isMobile ? 1 : 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ color: alpha('#000', 0.3), fontWeight: 500, fontSize: isMobile ? '0.55rem' : '0.65rem' }}>
              CET
            </Typography>
          </Box>
          {weekDays.map((day, index) => {
            const dayIsToday = isToday(day);
            const dayIsWeekend = isWeekend(day);
            const dayEventsCount = getEventsForDay(day).length;
            
            return (
              <Box
                component={motion.div}
                key={day.toISOString()}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                sx={{
                  p: isMobile ? 0.75 : 1.5,
                  textAlign: 'center',
                  borderLeft: `1px solid ${alpha('#000', 0.04)}`,
                  bgcolor: dayIsToday ? alpha('#7C3AED', 0.05) : dayIsWeekend ? alpha('#000', 0.02) : 'transparent',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: dayIsToday ? alpha('#7C3AED', 0.1) : alpha('#000', 0.04),
                  },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: dayIsToday ? '#7C3AED' : dayIsWeekend ? alpha('#000', 0.35) : alpha('#000', 0.5),
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    fontSize: isMobile ? '0.5rem' : '0.65rem',
                  }}
                >
                  {format(day, isMobile ? 'EEEEE' : 'EEE', { locale: nb })}
                </Typography>
                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                  <Typography
                    variant={isMobile ? 'body1' : 'h4'}
                    sx={{
                      fontWeight: 700,
                      color: dayIsToday ? '#7C3AED' : dayIsWeekend ? alpha('#000', 0.4) : '#1a1a2e',
                      lineHeight: 1.2,
                      fontSize: isMobile ? '0.9rem' : undefined,
                    }}
                  >
                    {format(day, 'd')}
                  </Typography>
                  {dayIsToday && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: isMobile ? -2 : -4,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: '#7C3AED',
                      }}
                    />
                  )}
                </Box>
                {dayEventsCount > 0 && (
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={dayEventsCount}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        bgcolor: dayIsToday ? '#7C3AED' : alpha('#000', 0.08),
                        color: dayIsToday ? '#fff' : alpha('#000', 0.6),
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
        )}
        
        {/* Time Grid - Only shown in week view */}
        {viewMode === 'week' && (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '50px repeat(7, 1fr)' : '70px repeat(7, 1fr)',
              position: 'relative',
              minHeight: TIME_SLOTS.length * (isMobile ? 48 : 60),
            }}
          >
            {/* Time Labels */}
            <Box>
              {TIME_SLOTS.map((hour) => (
                <Box
                  key={hour}
                  sx={{
                    height: isMobile ? 48 : 60,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-end',
                    pr: isMobile ? 0.75 : 1.5,
                    pt: 0.5,
                  }}
                >
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: alpha('#000', 0.35),
                      fontSize: isMobile ? '0.55rem' : '0.7rem',
                      fontWeight: 500,
                    }}
                  >
                    {hour.toString().padStart(2, '0')}:00
                  </Typography>
                </Box>
              ))}
            </Box>
            
            {/* Day Columns */}
            {weekDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const dayIsWeekend = isWeekend(day);
              const dayIsToday = isToday(day);
              
              return (
                <Box
                  key={day.toISOString()}
                  sx={{
                    position: 'relative',
                    borderLeft: `1px solid ${alpha('#000', 0.04)}`,
                    bgcolor: dayIsToday 
                      ? alpha('#7C3AED', 0.02) 
                      : dayIsWeekend 
                        ? alpha('#000', 0.015) 
                        : 'transparent',
                  }}
                >
                  {/* Hour grid lines */}
                  {TIME_SLOTS.map((hour) => (
                    <Box
                      key={hour}
                      onClick={() => handleTimeSlotClick(day, hour)}
                      sx={{
                        height: isMobile ? 48 : 60,
                        borderBottom: `1px solid ${alpha('#000', 0.04)}`,
                        '&:hover': {
                          bgcolor: alpha('#7C3AED', 0.06),
                          '&::after': isMobile ? {} : {
                            content: '"+ Ny hendelse"',
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            fontSize: '0.65rem',
                            color: '#7C3AED',
                            fontWeight: 600,
                            opacity: 0.7,
                          },
                        },
                        transition: 'background-color 0.15s ease',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                    />
                  ))}
                  
                  {/* Current time indicator */}
                  {dayIsToday && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: `${((new Date().getHours() - 6) * 60 + new Date().getMinutes())}px`,
                        height: 2,
                        bgcolor: '#EF4444',
                        zIndex: 100,
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: -4,
                          top: -3,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: '#EF4444',
                        },
                      }}
                    />
                  )}
                  
                  {/* Events */}
                  {dayEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      crew={crew}
                      onClick={handleEventClick}
                      compact={isMobile}
                    />
                  ))}
                </Box>
              );
            })}
          </Box>
        </Box>
        )}
        
        {/* ============================================================================ */}
        {/* MONTH VIEW */}
        {/* ============================================================================ */}
        {viewMode === 'Month' && (
          <Box sx={{ flex: 1, overflow: 'auto', p: isMobile ? 1 : 2 }}>
            {/* Day names header */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                mb: 1,
                borderBottom: `1px solid ${alpha('#000', 0.06)}`,
                pb: 1,
              }}
            >
              {(isMobile ? ['M', 'T', 'O', 'T', 'F', 'L', 'S'] : ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']).map((day, i) => (
                <Typography
                  key={`${day}-${i}`}
                  variant="caption"
                  sx={{
                    textAlign: 'center',
                    color: alpha('#000', 0.5),
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    fontSize: isMobile ? '0.55rem' : '0.65rem',
                    letterSpacing: '0.05em',
                  }}
                >
                  {day}
                </Typography>
              ))}
            </Box>
            
            {/* Calendar grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: isMobile ? 0.25 : 0.5,
              }}
            >
              {monthDays.map((day) => {
                const dayEvents = getEventsForDay(day);
                const dayIsToday = isToday(day);
                const dayInMonth = isSameMonth(day, selectedDate);
                const dayIsWeekend = isWeekend(day);
                
                return (
                  <Box
                    component={motion.div}
                    key={day.toISOString()}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => {
                      setSelectedDate(day);
                      setViewMode('Day');
                    }}
                    sx={{
                      minHeight: isMobile ? 60 : 100,
                      p: isMobile ? 0.5 : 1,
                      borderRadius: isMobile ? 1 : 2,
                      bgcolor: dayIsToday 
                        ? alpha('#7C3AED', 0.1) 
                        : !dayInMonth 
                          ? alpha('#000', 0.02) 
                          : dayIsWeekend 
                            ? alpha('#000', 0.015)
                            : 'white',
                      border: dayIsToday 
                        ? `2px solid ${alpha('#7C3AED', 0.5)}` 
                        : `1px solid ${alpha('#000', 0.04)}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        boxShadow: `0 4px 12px ${alpha('#000', 0.1)}`,
                        borderColor: alpha('#7C3AED', 0.3),
                      },
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: dayIsToday ? 700 : 600,
                        color: dayIsToday 
                          ? '#7C3AED' 
                          : !dayInMonth 
                            ? alpha('#000', 0.25) 
                            : '#1a1a2e',
                        mb: 0.5,
                      }}
                    >
                      {format(day, 'd')}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      {dayEvents.slice(0, 3).map((event) => {
                        const config = DEPARTMENT_CONFIG[event.department];
                        return (
                          <Box
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(event);
                            }}
                            sx={{
                              px: 0.75,
                              py: 0.25,
                              borderRadius: 0.5,
                              bgcolor: alpha(config.color, 0.15),
                              borderLeft: `2px solid ${config.color}`,
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: alpha(config.color, 0.25),
                              },
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: '0.6rem',
                                fontWeight: 600,
                                color: '#1a1a2e',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'block',
                              }}
                            >
                              {event.title}
                            </Typography>
                          </Box>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.55rem',
                            color: alpha('#000', 0.5),
                            fontWeight: 500,
                          }}
                        >
                          +{dayEvents.length - 3} mer
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
        
        {/* ============================================================================ */}
        {/* DAY VIEW */}
        {/* ============================================================================ */}
        {viewMode === 'Day' && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Day header */}
            <Box
              sx={{
                p: isMobile ? 1.5 : 2,
                borderBottom: `1px solid ${alpha('#000', 0.06)}`,
                bgcolor: isToday(selectedDate) ? alpha('#7C3AED', 0.05) : alpha('#f8f9fa', 0.5),
              }}
            >
              <Typography
                variant={isMobile ? 'subtitle1' : 'h5'}
                sx={{
                  fontWeight: 700,
                  color: isToday(selectedDate) ? '#7C3AED' : '#1a1a2e',
                  textTransform: 'capitalize',
                  fontSize: isMobile ? '1rem' : undefined,
                }}
              >
                {format(selectedDate, isMobile ? 'EEE, d. MMM' : 'EEEE, d. MMMM yyyy', { locale: nb })}
              </Typography>
              {isToday(selectedDate) && (
                <Chip
                  label="I dag"
                  size="small"
                  sx={{
                    mt: 1,
                    bgcolor: '#7C3AED',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.65rem',
                  }}
                />
              )}
            </Box>
            
            {/* Day time grid */}
            <Box sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
              <Box sx={{ display: 'flex', minHeight: TIME_SLOTS.length * (isMobile ? 56 : 70) }}>
                {/* Time labels */}
                <Box sx={{ width: isMobile ? 50 : 70, flexShrink: 0 }}>
                  {TIME_SLOTS.map((hour) => (
                    <Box
                      key={hour}
                      sx={{
                        height: isMobile ? 56 : 70,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'flex-end',
                        pr: isMobile ? 0.75 : 1.5,
                        pt: 0.5,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: alpha('#000', 0.4),
                          fontSize: isMobile ? '0.6rem' : '0.75rem',
                          fontWeight: 500,
                        }}
                      >
                        {hour.toString().padStart(2, '0')}:00
                      </Typography>
                    </Box>
                  ))}
                </Box>
                
                {/* Events column */}
                <Box sx={{ flex: 1, position: 'relative', borderLeft: `1px solid ${alpha('#000', 0.06)}` }}>
                  {/* Hour grid lines */}
                  {TIME_SLOTS.map((hour) => (
                    <Box
                      key={hour}
                      onClick={() => handleTimeSlotClick(selectedDate, hour)}
                      sx={{
                        height: isMobile ? 56 : 70,
                        borderBottom: `1px solid ${alpha('#000', 0.04)}`,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                        '&:hover': {
                          bgcolor: alpha('#7C3AED', 0.06),
                        },
                      }}
                    />
                  ))}
                  
                  {/* Current time indicator */}
                  {isToday(selectedDate) && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: `${((new Date().getHours() - 6) * 70 + (new Date().getMinutes() / 60) * 70)}px`,
                        height: 2,
                        bgcolor: '#EF4444',
                        zIndex: 100,
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: -4,
                          top: -4,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: '#EF4444',
                        },
                      }}
                    />
                  )}
                  
                  {/* Day events */}
                  {getEventsForDay(selectedDate).map((event) => {
                    const config = DEPARTMENT_CONFIG[event.department];
                    const [startHour, startMin] = event.startTime.split(':').map(Number);
                    const [endHour, endMin] = event.endTime.split(':').map(Number);
                    const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
                    const topPx = ((startHour - 6) * 70 + (startMin / 60) * 70);
                    const heightPx = Math.max((durationMinutes / 60) * 70, 50);
                    
                    return (
                      <Box
                        component={motion.div}
                        key={event.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ scale: 1.01, zIndex: 20 }}
                        onClick={() => handleEventClick(event)}
                        sx={{
                          position: 'absolute',
                          left: 8,
                          right: 8,
                          top: `${topPx}px`,
                          height: `${heightPx}px`,
                          background: `linear-gradient(135deg, ${alpha(config.color, 0.3)} 0%, ${alpha(config.color, 0.2)} 100%)`,
                          borderLeft: `4px solid ${config.color}`,
                          borderRadius: 2,
                          p: 1.5,
                          cursor: 'pointer',
                          overflow: 'hidden',
                          backdropFilter: 'blur(4px)',
                          boxShadow: `0 2px 12px ${alpha(config.color, 0.25)}`,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            boxShadow: `0 4px 20px ${alpha(config.color, 0.4)}`,
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
                          <Box
                            sx={{
                              width: 28,
                              height: 28,
                              borderRadius: 1,
                              bgcolor: alpha(config.color, 0.3),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#1a1a2e',
                            }}
                          >
                            {config.icon}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                fontWeight: 700,
                                color: '#1a1a2e',
                                lineHeight: 1.2,
                              }}
                            >
                              {event.title}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: alpha('#000', 0.6),
                                fontWeight: 500,
                              }}
                            >
                              {event.startTime} - {event.endTime}
                            </Typography>
                          </Box>
                        </Box>
                        {event.description && heightPx > 80 && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: alpha('#000', 0.5),
                              display: 'block',
                              mt: 0.5,
                            }}
                          >
                            {event.description}
                          </Typography>
                        )}
                        {event.crewIds.length > 0 && heightPx > 100 && (
                          <AvatarGroup max={4} sx={{ mt: 1 }}>
                            {crew
                              .filter((c) => event.crewIds.includes(c.id))
                              .map((member) => (
                                <Avatar
                                  key={member.id}
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    bgcolor: DEPARTMENT_CONFIG[member.department].color,
                                  }}
                                >
                                  {member.name.charAt(0)}
                                </Avatar>
                              ))}
                          </AvatarGroup>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
            
            {/* Empty state for day view */}
            {getEventsForDay(selectedDate).length === 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  p: 4,
                }}
              >
                <EventAvailable sx={{ fontSize: 48, color: alpha('#000', 0.15), mb: 2 }} />
                <Typography variant="h6" sx={{ color: alpha('#000', 0.4), fontWeight: 600 }}>
                  Ingen hendelser denne dagen
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Add />}
                  onClick={() => {
                    setSelectedTimeSlot({ day: selectedDate, hour: 9 });
                    setCreateDialogOpen(true);
                  }}
                  sx={{ mt: 2 }}
                >
                  Opprett hendelse
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Box>
      
      {/* Event Detail Dialog */}
      <EventDetailDialog
        event={selectedEvent}
        crew={crew}
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        onEdit={handleEventEdit}
        onDelete={handleEventDelete}
      />
      
      {/* Create/Edit Event Dialog */}
      <EventFormDialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setEditingEvent(null);
          setSelectedTimeSlot(null);
        }}
        onSave={(eventData) => {
          if (editingEvent) {
            handleEventUpdate({
              ...editingEvent,
              ...eventData,
            } as CrewCalendarEvent);
          } else {
            handleCreateEvent(eventData);
          }
        }}
        event={editingEvent}
        crew={crew}
        defaultDate={selectedTimeSlot?.day || selectedDate}
        defaultHour={selectedTimeSlot?.hour}
      />
      
      {/* Search Dialog */}
      <SearchDialog
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false);
          setSearchQuery('');
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        events={filteredEvents}
        onEventClick={handleEventClick}
      />
      
      {/* Filter Dialog */}
      <Dialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <FilterList color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Filtrer Avdelinger
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setFilterDialogOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {(Object.entries(DEPARTMENT_CONFIG) as [Department, typeof DEPARTMENT_CONFIG[Department]][]).map(([dept, config]) => (
              <FormControlLabel
                key={dept}
                control={
                  <Checkbox
                    checked={enabledDepartments.has(dept)}
                    onChange={() => toggleDepartment(dept)}
                    sx={{
                      color: config.color,
                      '&.Mui-checked': { color: config.color },
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {config.icon}
                    <Typography>{config.label}</Typography>
                  </Box>
                }
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button 
            onClick={() => setEnabledDepartments(new Set())}
            color="inherit"
            size="small"
          >
            Fjern alle
          </Button>
          <Button 
            onClick={() => setEnabledDepartments(new Set(Object.keys(DEPARTMENT_CONFIG) as Department[]))}
            size="small"
          >
            Velg alle
          </Button>
          <Button 
            onClick={() => setFilterDialogOpen(false)}
            variant="contained"
          >
            Ferdig
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Settings Dialog */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Settings color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Kalenderinnstillinger
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setSettingsOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Time Format */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                Tidsformat
              </Typography>
              <ButtonGroup size="small" fullWidth>
                <Button variant="contained">24-timer</Button>
                <Button variant="outlined">12-timer (AM/PM)</Button>
              </ButtonGroup>
            </Box>
            
            {/* Week Start */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                Uken starter på
              </Typography>
              <ButtonGroup size="small" fullWidth>
                <Button variant="contained">Mandag</Button>
                <Button variant="outlined">Søndag</Button>
              </ButtonGroup>
            </Box>
            
            {/* Default View */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                Standardvisning
              </Typography>
              <FormControl fullWidth size="small">
                <Select defaultValue="week" MenuProps={{ sx: { zIndex: 1400 } }}>
                  <MenuItem value="Day">Dag</MenuItem>
                  <MenuItem value="week">Uke</MenuItem>
                  <MenuItem value="Month">Måned</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            {/* Working Hours */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                Arbeidstid (synlig i dag/uke-visning)
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Fra"
                  type="time"
                  size="small"
                  defaultValue="06:00"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="Til"
                  type="time"
                  size="small"
                  defaultValue="20:00"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Box>
            </Box>
            
            {/* Notifications */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                Påminnelser
              </Typography>
              <FormControlLabel
                control={<Checkbox defaultChecked />}
                label="Vis varsel for kommende hendelser"
              />
              <FormControlLabel
                control={<Checkbox defaultChecked />}
                label="15 minutter før hendelse"
              />
              <FormControlLabel
                control={<Checkbox />}
                label="1 time før hendelse"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSettingsOpen(false)} color="inherit">
            Avbryt
          </Button>
          <Button onClick={() => setSettingsOpen(false)} variant="contained">
            Lagre Innstillinger
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Notifications Popover / Dialog */}
      <Dialog
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha('#7C3AED', 0.08),
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Badge badgeContent={todayEvents} sx={{ '& .MuiBadge-badge': { bgcolor: '#7C3AED', color: 'white' } }}>
              <Notifications sx={{ color: '#7C3AED' }} />
            </Badge>
            <Typography variant="h6" fontWeight={600} sx={{ color: '#7C3AED' }}>
              Varsler
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setNotificationsOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {/* Today's Events */}
          <Box sx={{ p: 2, bgcolor: alpha('#7C3AED', 0.05) }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#7C3AED', mb: 1 }}>
              I dag ({todayEvents} hendelser)
            </Typography>
            {events
              .filter(e => isToday(e.date))
              .slice(0, 5)
              .map((event) => {
                const config = DEPARTMENT_CONFIG[event.department];
                return (
                  <Box
                    key={event.id}
                    component={motion.div}
                    whileHover={{ x: 4 }}
                    onClick={() => {
                      setNotificationsOpen(false);
                      handleEventClick(event);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      mb: 1,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: alpha('#7C3AED', 0.2),
                      boxShadow: `0 1px 4px ${alpha('#7C3AED', 0.08)}`,
                      '&:hover': {
                        borderColor: '#7C3AED',
                        boxShadow: `0 2px 8px ${alpha('#7C3AED', 0.15)}`,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1.5,
                        bgcolor: alpha(config.color, 0.15),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: config.color,
                      }}
                    >
                      {config.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        {event.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {event.startTime} - {event.endTime}
                      </Typography>
                    </Box>
                    <Chip
                      label={config.label}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.6rem',
                        bgcolor: alpha(config.color, 0.15),
                        color: config.color,
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                );
              })}
            {todayEvents === 0 && (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Ingen hendelser i dag
                </Typography>
              </Box>
            )}
          </Box>
          
          {/* Upcoming Events */}
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1 }}>
              Kommende hendelser
            </Typography>
            {events
              .filter(e => e.date > new Date() && !isToday(e.date))
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .slice(0, 3)
              .map((event) => {
                const config = DEPARTMENT_CONFIG[event.department];
                return (
                  <Box
                    key={event.id}
                    onClick={() => {
                      setNotificationsOpen(false);
                      handleEventClick(event);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: alpha('#000', 0.04),
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: config.color,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                        {event.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {format(event.date, 'd. MMM', { locale: nb })} • {event.startTime}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, justifyContent: 'center' }}>
          <Button
            onClick={() => {
              setNotificationsOpen(false);
              setViewMode('Day');
              setSelectedDate(new Date());
            }}
            size="small"
            startIcon={<Today />}
            sx={{ 
              color: '#7C3AED',
              '&:hover': { bgcolor: alpha('#7C3AED', 0.08) }
            }}
          >
            Se alle i dag
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CrewCalendarPanel;
