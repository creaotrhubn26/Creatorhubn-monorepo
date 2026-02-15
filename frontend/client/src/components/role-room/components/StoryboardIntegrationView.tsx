import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  Card,
  CardMedia,
  CardContent,
  Grid,
  IconButton,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Chip,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Image as ImageIcon,
  List as ListIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CameraAlt as CameraIcon,
  Lightbulb as LightIcon,
  Brush as BrushIcon,
  Create as CreateIcon,
  TouchApp as TouchAppIcon,
  Link as LinkIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { SceneBreakdown, StoryboardFrame as StoryboardFrameModel } from '../models/casting';
import { FrameDrawingEditor, QuickDrawButton } from './FrameDrawingEditor';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import { FrameDrawingData } from '../state/storyboardStore';
import { useScriptStoryboardOptional, SceneContext } from '../contexts/ScriptStoryboardContext';

interface StoryboardIntegrationViewProps {
  scene: SceneBreakdown;
  onUpdate: (scene: SceneBreakdown) => void;
  // Script integration
  scriptContent?: string;
  onScriptChange?: (content: string) => void;
  showScriptPanel?: boolean;
  activeFrameIndex?: number;
  onFrameSelect?: (index: number) => void;
}

type ViewMode = 'script' | 'storyboard' | 'shotlist' | 'split';

interface StoryboardFrame {
  id: string;
  shotNumber: string;
  imageUrl?: string;
  sketch?: string;
  drawingData?: FrameDrawingData; // iPad drawing data
  imageSource?: 'ai' | 'captured' | 'drawn' | 'uploaded' | 'generated';
  description: string;
  cameraAngle: string;
  movement: string;
  duration: number;
  notes?: string;
  // Script linking
  sceneId?: string;
  scriptLineRange?: [number, number];
  dialogueCharacter?: string;
}

export const StoryboardIntegrationView: React.FC<StoryboardIntegrationViewProps> = ({
  scene,
  onUpdate,
  scriptContent,
  onScriptChange,
  showScriptPanel = false,
  activeFrameIndex: propActiveFrameIndex,
  onFrameSelect,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(showScriptPanel ? 'split' : 'script');
  // Initialize from scene.storyboardFrames or create a default empty array
  const [storyboardFrames, setStoryboardFrames] = useState<StoryboardFrame[]>(() => {
    if (scene.storyboardFrames && scene.storyboardFrames.length > 0) {
      // Convert model frames to local format
      return scene.storyboardFrames.map((f): StoryboardFrame => ({
        id: f.id,
        shotNumber: f.shotNumber,
        imageUrl: f.imageUrl,
        sketch: f.sketch,
        description: f.description,
        cameraAngle: f.cameraAngle,
        movement: f.movement,
        duration: f.duration,
        notes: f.notes,
        sceneId: f.sceneId,
        scriptLineRange: f.scriptLineRange,
        dialogueCharacter: f.dialogueCharacter,
        drawingData: f.drawingData as FrameDrawingData | undefined,
        imageSource: f.imageSource as StoryboardFrame['imageSource'],
      }));
    }
    return [];
  });
  const [activeFrameIdx, setActiveFrameIdx] = useState(propActiveFrameIndex || 0);
  const device = useDeviceDetection();
  
  // Try to use script-storyboard context if available
  const scriptStoryboard = useScriptStoryboardOptional();
  const currentScene = scriptStoryboard?.currentScene;
  const currentDialogue = scriptStoryboard?.currentDialogue;
  const syncEnabled = scriptStoryboard?.syncEnabled ?? false;
  
  // Sync active frame with context
  useEffect(() => {
    if (propActiveFrameIndex !== undefined && propActiveFrameIndex !== activeFrameIdx) {
      setActiveFrameIdx(propActiveFrameIndex);
    }
  }, [propActiveFrameIndex]);

  // Sync storyboard frames back to parent scene when they change
  useEffect(() => {
    // Convert local frames to model format and update parent
    const modelFrames: StoryboardFrameModel[] = storyboardFrames.map(f => ({
      id: f.id,
      shotNumber: f.shotNumber,
      imageUrl: f.imageUrl,
      sketch: f.sketch,
      description: f.description,
      cameraAngle: f.cameraAngle,
      movement: f.movement,
      duration: f.duration,
      notes: f.notes,
      sceneId: f.sceneId || scene.id,
      scriptLineRange: f.scriptLineRange,
      dialogueCharacter: f.dialogueCharacter,
      drawingData: f.drawingData as StoryboardFrameModel['drawingData'],
      imageSource: f.imageSource,
    }));
    
    // Only update if frames actually changed
    const currentFrames = scene.storyboardFrames || [];
    if (JSON.stringify(modelFrames) !== JSON.stringify(currentFrames)) {
      onUpdate({
        ...scene,
        storyboardFrames: modelFrames,
      });
    }
  }, [storyboardFrames, scene.id]); // Don't include scene or onUpdate to avoid loops
  
  // Handle frame selection with script sync
  const handleFrameSelect = useCallback((index: number) => {
    setActiveFrameIdx(index);
    onFrameSelect?.(index);
    
    const frame = storyboardFrames[index];
    if (frame && scriptStoryboard) {
      scriptStoryboard.setActiveFrame(frame.id, index);
      
      // If frame has script line range and sync is enabled, scroll script
      if (syncEnabled && frame.scriptLineRange) {
        scriptStoryboard.goToScriptLine(frame.scriptLineRange[0]);
      }
    }
  }, [storyboardFrames, scriptStoryboard, syncEnabled, onFrameSelect]);
  
  // Link current frame to current script position
  const linkFrameToCurrentPosition = useCallback(() => {
    if (!scriptStoryboard || !currentScene) return;
    
    const frame = storyboardFrames[activeFrameIdx];
    if (!frame) return;
    
    const lineNumber = scriptStoryboard.scriptPosition.lineNumber;
    
    setStoryboardFrames(frames =>
      frames.map(f =>
        f.id === frame.id
          ? {
              ...f,
              sceneId: currentScene.sceneId,
              scriptLineRange: [lineNumber, lineNumber] as [number, number],
              dialogueCharacter: currentDialogue?.characterName,
            }
          : f
      )
    );
    
    scriptStoryboard.linkFrameToScript(
      frame.id,
      currentScene.sceneId,
      [lineNumber, lineNumber]
    );
  }, [scriptStoryboard, currentScene, currentDialogue, storyboardFrames, activeFrameIdx]);

  // Handle drawing completion for a frame
  const handleFrameDrawingComplete = (frameId: string, drawingData: FrameDrawingData, imageUrl: string) => {
    setStoryboardFrames(frames =>
      frames.map(f =>
        f.id === frameId
          ? { ...f, imageUrl, drawingData, imageSource: 'drawn' as const }
          : f
      )
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Script Context Banner when synced */}
      {syncEnabled && currentDialogue && (
        <Alert 
          severity="info" 
          icon={<SyncIcon sx={{ fontSize: 18 }} />}
          sx={{ 
            borderRadius: 0, 
            py: 0.5,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
          }}
          action={
            <Tooltip title="Link frame to this script position">
              <IconButton size="small" onClick={linkFrameToCurrentPosition}>
                <LinkIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          }
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <Chip 
              label={currentDialogue.characterName} 
              size="small" 
              sx={{ fontWeight: 600, fontSize: 11, height: 20 }}
            />
            <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
              "{currentDialogue.dialogueText?.slice(0, 60)}..."
            </Typography>
          </Stack>
        </Alert>
      )}
      
      {/* View Mode Selector */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={2}>
            <Typography variant="h6">Scene {scene.sceneNumber}</Typography>
            {storyboardFrames[activeFrameIdx]?.scriptLineRange && (
              <Chip
                icon={<LinkIcon sx={{ fontSize: 14 }} />}
                label={`Lines ${storyboardFrames[activeFrameIdx].scriptLineRange![0]}-${storyboardFrames[activeFrameIdx].scriptLineRange![1]}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: 10 }}
              />
            )}
          </Stack>
          
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, mode) => mode && setViewMode(mode)}
            size="small"
          >
            <ToggleButton value="script">
              <DescriptionIcon sx={{ mr: 1 }} />
              Manus
            </ToggleButton>
            <ToggleButton value="storyboard">
              <ImageIcon sx={{ mr: 1 }} />
              Storyboard
            </ToggleButton>
            <ToggleButton value="shotlist">
              <ListIcon sx={{ mr: 1 }} />
              Shot-liste
            </ToggleButton>
            {showScriptPanel && (
              <ToggleButton value="split">
                <SyncIcon sx={{ mr: 1 }} />
                Split
              </ToggleButton>
            )}
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {viewMode === 'script' && <ScriptView scene={scene} />}
        {viewMode === 'storyboard' && (
          <StoryboardView
            frames={storyboardFrames}
            onUpdate={setStoryboardFrames}
            onFrameDrawingComplete={handleFrameDrawingComplete}
            sceneId={scene.id}
          />
        )}
        {viewMode === 'shotlist' && (
          <ShotListView
            frames={storyboardFrames}
            onUpdate={setStoryboardFrames}
          />
        )}
      </Box>
    </Box>
  );
};

const ScriptView: React.FC<{ scene: SceneBreakdown }> = ({ scene }) => {
  return (
    <Paper sx={{ p: 4, fontFamily: 'Courier, monospace', bgcolor: '#FFFFF8' }}>
      <Stack spacing={3}>
        {/* Scene Heading */}
        <Typography variant="h6" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
          {scene.intExt}. {scene.locationName} - {scene.timeOfDay}
        </Typography>

        {/* Scene Description */}
        {scene.description && (
          <Typography sx={{ lineHeight: 2 }}>
            {scene.description}
          </Typography>
        )}

        {/* Dialogue */}
        {scene.characters && scene.characters.length > 0 && (
          <Stack spacing={2}>
            {scene.characters.map((char, i) => (
              <Box key={i}>
                <Typography
                  sx={{
                    textAlign: 'center',
                    fontWeight: 'bold',
                    mb: 1,
                  }}
                >
                  {char.toUpperCase()}
                </Typography>
                <Typography
                  sx={{
                    textAlign: 'center',
                    maxWidth: '60%',
                    mx: 'auto',
                    fontStyle: 'italic',
                    color: 'text.secondary',
                  }}
                >
                  (eksempel dialog for {char})
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};

const StoryboardView: React.FC<{
  frames: StoryboardFrame[];
  onUpdate: (frames: StoryboardFrame[]) => void;
  onFrameDrawingComplete: (frameId: string, drawingData: FrameDrawingData, imageUrl: string) => void;
  sceneId: string;
}> = ({ frames, onUpdate, onFrameDrawingComplete, sceneId }) => {
  const device = useDeviceDetection();
  const [drawingFrameId, setDrawingFrameId] = useState<string | null>(null);

  const handleAddFrame = () => {
    const newFrame: StoryboardFrame = {
      id: `${frames.length + 1}`,
      shotNumber: `${frames.length + 1}A`,
      description: 'Ny shot',
      cameraAngle: 'Medium',
      movement: 'Static',
      duration: 2,
    };
    onUpdate([...frames, newFrame]);
  };

  const drawingFrame = frames.find(f => f.id === drawingFrameId);

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <Typography variant="h6">Storyboard</Typography>
        <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={handleAddFrame}>
          Ny Frame
        </Button>
        {(device.isIPad || device.hasTouchScreen) && (
          <Chip
            icon={device.hasPencilSupport ? <CreateIcon /> : <TouchAppIcon />}
            label={device.hasPencilSupport ? 'Apple Pencil Ready' : 'Touch Drawing'}
            size="small"
            color="secondary"
            variant="outlined"
          />
        )}
      </Stack>

      <Grid container spacing={2}>
        {frames.map((frame, index) => (
          <Grid key={frame.id} size={{ xs: 12, md: 6, lg: 4 }}>
            <StoryboardFrameCard
              frame={frame}
              index={index}
              onDrawClick={() => setDrawingFrameId(frame.id)}
              showDrawButton={device.isIPad || device.hasTouchScreen}
            />
          </Grid>
        ))}
      </Grid>

      {/* iPad Drawing Editor Dialog */}
      {drawingFrame && (
        <FrameDrawingEditor
          frameId={drawingFrame.id}
          aspectRatio="16:9"
          initialImage={drawingFrame.imageUrl}
          mode="dialog"
          sceneId={sceneId}
          onSave={(drawingData, imageUrl) => {
            onFrameDrawingComplete(drawingFrame.id, drawingData, imageUrl);
            setDrawingFrameId(null);
          }}
          onCancel={() => setDrawingFrameId(null)}
        />
      )}
    </Box>
  );
};

const StoryboardFrameCard: React.FC<{
  frame: StoryboardFrame;
  index: number;
  onDrawClick?: () => void;
  showDrawButton?: boolean;
}> = ({ frame, index, onDrawClick, showDrawButton }) => {
  return (
    <Card>
      {/* Frame Image/Sketch Area */}
      <Box
        sx={{
          position: 'relative',
          paddingTop: '56.25%', // 16:9 aspect ratio
          bgcolor: 'grey.100',
          borderBottom: 1,
          borderColor: 'divider',
          cursor: showDrawButton ? 'pointer' : 'default',
        }}
        onClick={showDrawButton && !frame.imageUrl ? onDrawClick : undefined}
      >
        {frame.imageUrl ? (
          <CardMedia
            component="img"
            image={frame.imageUrl}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'grey.200',
            }}
          >
            <Stack spacing={1} alignItems="center">
              {showDrawButton ? (
                <>
                  <BrushIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                  <Typography variant="caption" color="text.secondary">
                    Tap to draw with Apple Pencil
                  </Typography>
                </>
              ) : (
                <>
                  <ImageIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    Klikk for å legge til skisse
                  </Typography>
                </>
              )}
            </Stack>
          </Box>
        )}

        {/* Shot Number Overlay */}
        <Chip
          label={`Shot ${frame.shotNumber}`}
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            bgcolor: 'rgba(0,0,0,0.7)',
            color: 'white',
          }}
        />

        {/* Image Source Badge */}
        {frame.imageSource === 'drawn' && (
          <Chip
            icon={<BrushIcon sx={{ fontSize: 12 }} />}
            label="Drawn"
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(139,92,246,0.9)',
              color: 'white',
              '& .MuiChip-icon': { color: 'white' },
            }}
          />
        )}

        {/* Draw/Edit Button */}
        {showDrawButton && frame.imageUrl && (
          <Tooltip title="Edit Drawing">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDrawClick?.();
              }}
              sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                bgcolor: 'rgba(139,92,246,0.9)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(139,92,246,1)' },
              }}
            >
              <BrushIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Camera & Light Indicators */}
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
          }}
        >
          <IconButton size="small" sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
            <CameraIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
            <LightIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <CardContent>
        <Stack spacing={1}>
          <Typography variant="body2" fontWeight="medium">
            {frame.description}
          </Typography>

          <Stack direction="row" spacing={1}>
            <Chip label={frame.cameraAngle} size="small" />
            <Chip label={frame.movement} size="small" />
            <Chip label={`${frame.duration}s`} size="small" />
          </Stack>

          {frame.notes && (
            <Typography variant="caption" color="text.secondary">
              {frame.notes}
            </Typography>
          )}

          <Stack direction="row" spacing={1} mt={1}>
            <IconButton size="small" color="primary">
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

const ShotListView: React.FC<{
  frames: StoryboardFrame[];
  onUpdate: (frames: StoryboardFrame[]) => void;
}> = ({ frames, onUpdate }) => {
  return (
    <Paper>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Shot #</TableCell>
            <TableCell>Beskrivelse</TableCell>
            <TableCell>Kamera</TableCell>
            <TableCell>Bevegelse</TableCell>
            <TableCell>Varighet</TableCell>
            <TableCell>Notater</TableCell>
            <TableCell>Handlinger</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {frames.map((frame) => (
            <TableRow key={frame.id} hover>
              <TableCell>
                <Chip label={frame.shotNumber} size="small" />
              </TableCell>
              <TableCell>{frame.description}</TableCell>
              <TableCell>{frame.cameraAngle}</TableCell>
              <TableCell>{frame.movement}</TableCell>
              <TableCell>{frame.duration}s</TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">
                  {frame.notes || '-'}
                </Typography>
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={1}>
                  <IconButton size="small" color="primary">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Box sx={{ p: 2 }}>
        <Button
          startIcon={<AddIcon />}
          variant="outlined"
          fullWidth
          onClick={() => {
            const newFrame: StoryboardFrame = {
              id: `${frames.length + 1}`,
              shotNumber: `${frames.length + 1}A`,
              description: 'Ny shot',
              cameraAngle: 'Medium',
              movement: 'Static',
              duration: 2,
            };
            onUpdate([...frames, newFrame]);
          }}
        >
          Legg til Shot
        </Button>
      </Box>
    </Paper>
  );
};

export default StoryboardIntegrationView;
