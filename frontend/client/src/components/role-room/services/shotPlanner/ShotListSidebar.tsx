/**
 * Shot List Sidebar
 * 
 * Left sidebar panel showing scene info and shot list.
 * Includes shot categories (Establishing, Coverage, Details).
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Button,
  Chip,
  Collapse,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
  TextField,
  Select,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Edit as EditIcon,
  Videocam as CameraIcon,
  FilterList as FilterIcon,
  Movie as MovieIcon,
  PhotoCamera as PhotoIcon,
  MoreVert as MoreIcon,
  CheckCircle as CompletedIcon,
  Schedule as PlannedIcon,
  PlayCircle as InProgressIcon,
  ArrowDropDown as DropdownIcon,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useShotPlannerStore, useShots, useCurrentScene } from './store';
import { Shot2D, SHOT_TYPE_INFO, ShotType } from './types';

// =============================================================================
// Shot Categories
// =============================================================================

const SHOT_CATEGORIES = [
  { id: 'establishing', label: 'Establishing', icon: '🎬' },
  { id: 'coverage', label: 'Coverage', icon: '📹' },
  { id: 'details', label: 'Details', icon: '🔍' },
] as const;

// =============================================================================
// Status Colors
// =============================================================================

const STATUS_CONFIG: Record<Shot2D['status'], { color: string; icon: React.ReactNode }> = {
  'Planned': { color: '#8896A6', icon: <PlannedIcon sx={{ fontSize: 16 }} /> },
  'Setup': { color: '#FFB74D', icon: <PlannedIcon sx={{ fontSize: 16 }} /> },
  'Rehearsal': { color: '#4FC3F7', icon: <InProgressIcon sx={{ fontSize: 16 }} /> },
  'Shot': { color: '#81C784', icon: <CompletedIcon sx={{ fontSize: 16 }} /> },
  'Printed': { color: '#4CAF50', icon: <CompletedIcon sx={{ fontSize: 16 }} /> },
};

// =============================================================================
// Sortable Shot Item
// =============================================================================

interface SortableShotItemProps {
  shot: Shot2D;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  cameraName?: string;
}

const SortableShotItem: React.FC<SortableShotItemProps> = ({
  shot,
  isActive,
  onSelect,
  onDelete,
  cameraName,
}) => {
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
  
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [statusAnchor, setStatusAnchor] = useState<null | HTMLElement>(null);
  
  const statusConfig = STATUS_CONFIG[shot.status];
  
  const { updateShot } = useShotPlannerStore();
  
  return (
    <>
      <ListItem
        ref={setNodeRef}
        style={style}
        onClick={onSelect}
        sx={{
          backgroundColor: isActive ? 'rgba(79, 195, 247, 0.15)' : 'transparent',
          borderLeft: isActive ? '3px solid #4FC3F7' : '3px solid transparent',
          cursor: 'pointer',
          borderRadius: 1,
          mb: 0.5,
          '&:hover': {
            backgroundColor: 'rgba(79, 195, 247, 0.08)',
          },
          transition: 'all 0.2s',
        }}
        secondaryAction={
          <Stack direction="row" spacing={0.5}>
            {/* Status Quick Select */}
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setStatusAnchor(e.currentTarget);
              }}
              sx={{
                color: statusConfig.color,
                fontSize: 14,
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
              }}
              title={shot.status}
            >
              {statusConfig.icon}
            </IconButton>
            
            {/* More menu */}
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchor(e.currentTarget);
              }}
              sx={{
                color: '#8896A6',
                fontSize: 14,
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
              }}
            >
              <MoreIcon sx={{ color: '#8896A6', fontSize: 18 }} />
            </IconButton>
          </Stack>
        }
      >
        <Box
          {...attributes}
          {...listeners}
          sx={{
            display: 'flex',
            alignItems: 'center',
            mr: 1,
            cursor: 'grab',
            color: '#8896A6',
          }}
        >
          <DragIcon sx={{ fontSize: 18 }} />
        </Box>
        
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="body2"
                sx={{
                  color: isActive ? '#4FC3F7' : '#FFFFFF',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {shot.number}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: '#FFFFFF', fontWeight: 500 }}
              >
                {shot.name}
              </Typography>
            </Box>
          }
          secondary={
            <Typography variant="caption" sx={{ color: '#8896A6' }}>
              {SHOT_TYPE_INFO[shot.shotType as ShotType]?.abbr || shot.shotType} / {shot.lens} / {shot.status}
            </Typography>
          }
        />
      </ListItem>
      
      {/* Status Menu */}
      <Menu
        anchorEl={statusAnchor}
        open={Boolean(statusAnchor)}
        onClose={() => setStatusAnchor(null)}
      >
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <MenuItem
            key={status}
            onClick={() => {
              updateShot(shot.id, { status: status as Shot2D['status'] });
              setStatusAnchor(null);
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: shot.status === status ? config.color : 'inherit',
              backgroundColor: shot.status === status ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            }}
          >
            <Box sx={{ color: config.color, display: 'flex' }}>
              {config.icon}
            </Box>
            <Typography variant="body2">{status}</Typography>
          </MenuItem>
        ))}
      </Menu>
      
      {/* More Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => { setMenuAnchor(null); }}>
          <EditIcon sx={{ mr: 1, fontSize: 18 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => { onDelete(); setMenuAnchor(null); }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 18, color: '#F44336' }} /> Delete
        </MenuItem>
      </Menu>
    </>
  );
};

// =============================================================================
// Main Component
// =============================================================================

interface ShotListSidebarProps {
  onAddShot?: () => void;
}

export const ShotListSidebar: React.FC<ShotListSidebarProps> = ({ onAddShot }) => {
  const scene = useCurrentScene();
  const shots = useShots();
  const {
    selectShot,
    deleteShot,
    reorderShots,
    updateScene,
    addCamera,
    addShot,
  } = useShotPlannerStore();
  
  const [sceneMenuAnchor, setSceneMenuAnchor] = useState<null | HTMLElement>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    establishing: true,
    coverage: true,
    details: true,
  });
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = shots.findIndex(s => s.id === active.id);
      const newIndex = shots.findIndex(s => s.id === over.id);
      reorderShots(oldIndex, newIndex);
    }
  };
  
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };
  
  const getCameraName = (cameraId: string) => {
    return scene?.cameras.find(c => c.id === cameraId)?.name || 'Unknown';
  };
  
  const getShotsByCategory = (category: string) => {
    return shots.filter(shot => {
      if (category === 'establishing') {
        return shot.category === 'Establishing' || 
               ['EWS', 'WS', 'MWS'].includes(shot.shotType);
      }
      if (category === 'coverage') {
        return shot.category === 'Coverage' ||
               ['MS', 'MCU', 'CU', 'OTS', 'Two-Shot'].includes(shot.shotType);
      }
      if (category === 'details') {
        return shot.category === 'Details' ||
               ['BCU', 'ECU', 'Insert'].includes(shot.shotType);
      }
      return false;
    });
  };
  
  const handleAddShot = () => {
    if (scene?.cameras.length === 0) {
      // Add a camera first if none exist
      const cameraId = addCamera({ x: 400, y: 300 });
      addShot(cameraId);
    } else if (scene?.cameras[0]) {
      addShot(scene.cameras[0].id);
    }
    onAddShot?.();
  };
  
  if (!scene) {
    return (
      <Paper
        sx={{
          p: 2,
          height: '100%',
          backgroundColor: '#1E2D3D',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="body2" sx={{ color: '#8896A6' }}>
          No scene loaded
        </Typography>
      </Paper>
    );
  }
  
  return (
    <Paper
      sx={{
        height: '100%',
        backgroundColor: '#1E2D3D',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Scene Header */}
      <Box
        sx={{
          p: 2,
          backgroundColor: '#2A3F4F',
          borderBottom: '1px solid #3A4A5A',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle1" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
              {scene.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#8896A6' }}>
              {scene.location || 'INT./EXT. - TIME'}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => setSceneMenuAnchor(e.currentTarget)}
          >
            <DropdownIcon sx={{ color: '#8896A6' }} />
          </IconButton>
        </Box>
        
        <Menu
          anchorEl={sceneMenuAnchor}
          open={Boolean(sceneMenuAnchor)}
          onClose={() => setSceneMenuAnchor(null)}
        >
          <MenuItem onClick={() => setSceneMenuAnchor(null)}>
            Edit Scene Details
          </MenuItem>
          <MenuItem onClick={() => setSceneMenuAnchor(null)}>
            Import Floor Plan
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => setSceneMenuAnchor(null)}>
            Export Scene
          </MenuItem>
        </Menu>
      </Box>
      
      {/* Shot List Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #3A4A5A',
        }}
      >
        <Typography variant="subtitle2" sx={{ color: '#FFFFFF' }}>
          Shot List
        </Typography>
        <IconButton size="small">
          <FilterIcon sx={{ color: '#8896A6', fontSize: 18 }} />
        </IconButton>
      </Box>
      
      {/* Shot List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={shots.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <List dense disablePadding>
              {shots.map((shot) => (
                <SortableShotItem
                  key={shot.id}
                  shot={shot}
                  isActive={scene.activeShotId === shot.id}
                  onSelect={() => selectShot(shot.id)}
                  onDelete={() => deleteShot(shot.id)}
                  cameraName={getCameraName(shot.cameraId)}
                />
              ))}
            </List>
          </SortableContext>
        </DndContext>
        
        {shots.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4,
              color: '#8896A6',
            }}
          >
            <MovieIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
            <Typography variant="body2" align="center">
              No shots yet
            </Typography>
            <Typography variant="caption" align="center">
              Add a camera to create shots
            </Typography>
          </Box>
        )}
      </Box>
      
      {/* Category Quick Filters */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: '1px solid #3A4A5A',
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        {SHOT_CATEGORIES.map(category => {
          const categoryShots = getShotsByCategory(category.id);
          return (
            <Chip
              key={category.id}
              label={`${category.icon} ${category.label}`}
              size="small"
              onClick={() => toggleCategory(category.id)}
              sx={{
                backgroundColor: expandedCategories[category.id] ? '#3A4A5A' : 'transparent',
                color: '#FFFFFF',
                border: '1px solid #3A4A5A',
                '&:hover': { backgroundColor: '#3A4A5A' },
              }}
            />
          );
        })}
      </Box>
      
      {/* Add Shot Button */}
      <Box sx={{ p: 2, borderTop: '1px solid #3A4A5A' }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddShot}
          sx={{
            borderColor: '#4FC3F7',
            color: '#4FC3F7',
            '&:hover': {
              borderColor: '#29B6F6',
              backgroundColor: 'rgba(79, 195, 247, 0.08)',
            },
          }}
        >
          Add Shot
        </Button>
      </Box>
    </Paper>
  );
};

export default ShotListSidebar;
