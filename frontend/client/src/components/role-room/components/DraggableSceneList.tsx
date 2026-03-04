import { useState } from 'react';
import type { DragEvent, FC } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Card,
  CardContent,
  IconButton,
  Chip,
  Tooltip,
  alpha,
} from '@mui/material';
import { DragIndicator as DragIcon, Theaters as TheatersIcon, Warning as WarningIcon } from '@mui/icons-material';
import type { SceneBreakdown } from '../models/casting';

interface DraggableSceneListProps {
  scenes: SceneBreakdown[];
  onReorder: (scenes: SceneBreakdown[]) => void;
  onSceneSelect: (scene: SceneBreakdown) => void;
  selectedScene?: SceneBreakdown;
}

export const DraggableSceneList: FC<DraggableSceneListProps> = ({
  scenes,
  onReorder,
  onSceneSelect,
  selectedScene,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reorderedScenes = [...scenes];
    const [draggedScene] = reorderedScenes.splice(draggedIndex, 1);
    reorderedScenes.splice(dropIndex, 0, draggedScene);

    // Update scene numbers
    const updatedScenes = reorderedScenes.map((scene, index) => ({
      ...scene,
      sceneNumber: `${index + 1}`,
    }));

    onReorder(updatedScenes);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <Stack spacing={1}>
      {scenes.map((scene, index) => (
        <DraggableSceneCard
          key={scene.id || index}
          scene={scene}
          index={index}
          isDragging={draggedIndex === index}
          isDragOver={dragOverIndex === index}
          isSelected={selectedScene?.id === scene.id}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          onClick={() => onSceneSelect(scene)}
        />
      ))}
    </Stack>
  );
};

interface DraggableSceneCardProps {
  scene: SceneBreakdown;
  index: number;
  isDragging: boolean;
  isDragOver: boolean;
  isSelected: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

const DraggableSceneCard: FC<DraggableSceneCardProps> = ({
  scene,
  index,
  isDragging,
  isDragOver,
  isSelected,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onClick,
}) => {
  const hasIssues = !scene.locationName || !scene.timeOfDay;

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onClick}
      sx={{
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        transform: isDragOver ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.2s',
        border: 2,
        borderColor: isSelected
          ? 'primary.main'
          : isDragOver
          ? 'secondary.main'
          : 'transparent',
        bgcolor: isDragOver ? alpha('#90caf9', 0.1) : 'background.paper',
        '&:hover': {
          boxShadow: 3,
        },
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          {/* Drag Handle */}
          <IconButton
            size="small"
            sx={{
              cursor: 'grab',
              '&:active': { cursor: 'grabbing' },
            }}
          >
            <DragIcon />
          </IconButton>

          {/* Scene Number */}
          <Box
            sx={{
              minWidth: 60,
              height: 60,
              borderRadius: 2,
              bgcolor: scene.intExt === 'INT' ? 'info.light' : 'warning.light',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="h6">{scene.sceneNumber}</Typography>
          </Box>

          {/* Scene Info */}
          <Box flex={1}>
            <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
              <TheatersIcon fontSize="small" color="action" />
              <Typography variant="subtitle1">
                {scene.locationName || 'Ingen lokasjon'}
              </Typography>
              {hasIssues && (
                <Tooltip title="Mangler informasjon">
                  <WarningIcon fontSize="small" color="error" />
                </Tooltip>
              )}
            </Stack>

            <Stack direction="row" spacing={1} mb={1}>
              <Chip label={scene.intExt} size="small" />
              <Chip label={scene.timeOfDay} size="small" />
              {scene.estimatedDuration && (
                <Chip label={`${scene.estimatedDuration} min`} size="small" />
              )}
            </Stack>

            {scene.description && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {scene.description}
              </Typography>
            )}
          </Box>

          {/* Characters */}
          {scene.characters && scene.characters.length > 0 && (
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                {scene.characters.length} karakterer
              </Typography>
              <Stack direction="row" spacing={0.5}>
                {scene.characters.slice(0, 3).map((char, i) => (
                  <Chip key={i} label={char} size="small" sx={{ fontSize: '0.7rem' }} />
                ))}
                {scene.characters.length > 3 && (
                  <Chip label={`+${scene.characters.length - 3}`} size="small" />
                )}
              </Stack>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default DraggableSceneList;
