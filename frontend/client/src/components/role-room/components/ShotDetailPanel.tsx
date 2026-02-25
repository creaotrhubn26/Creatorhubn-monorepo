import React, { useState, useEffect } from 'react';
import { ContextualNudgeBanner } from './ContextualNudgeBanner';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Button,
  IconButton,
  Card,
  CardContent,
  Slider,
  Chip,
  Divider,
  Paper,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  Lightbulb as LightbulbIcon,
  Mic as MicIcon,
  Note as NoteIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
  ExpandMore as ExpandMoreIcon,
  CameraAlt as CameraAltIcon,
} from '@mui/icons-material';
import { SceneBreakdown } from '../models/casting';
import { useToast } from './ToastStack';

interface ShotDetailPanelProps {
  scene: SceneBreakdown;
  onUpdate: (scene: SceneBreakdown) => void;
}

interface ShotCamera {
  id: string;
  shotNumber: string;
  focalLength: number; // mm
  cameraType: string; // e.g., "RED Komodo", "ARRI Alexa"
  lensType: string; // e.g., "Prime", "Zoom"
  movement: string; // "Static", "Pan", "Tilt", "Dolly", "Steadicam", "Handheld"
  framing: string; // "Wide", "Medium", "Close-up", "ECU"
  angle: string; // "Eye-level", "High", "Low", "Dutch"
  notes?: string;
}

interface ShotLighting {
  id: string;
  shotNumber: string;
  keyLight: { direction: string; intensity: number; color: string };
  fillLight: { direction: string; intensity: number; color: string };
  rimLight: { direction: string; intensity: number; color: string };
  practicals: string[];
  colorTemp: number; // Kelvin
  lightingStyle: string; // "Natural", "Dramatic", "High-key", "Low-key"
  notes?: string;
}

interface ShotAudio {
  id: string;
  shotNumber: string;
  dialogueType: string; // "Sync", "ADR", "Voice-over"
  atmosphereNeeded: string[];
  foleyNeeded: string[];
  musicCue?: string;
  micSetup: string; // "Boom", "Lav", "Plant"
  notes?: string;
}

interface ShotNote {
  id: string;
  shotNumber: string;
  category: string; // "Director", "VFX", "Continuity", "Performance"
  content: string;
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  resolved: boolean;
  createdAt: string;
}

export const ShotDetailPanel: React.FC<ShotDetailPanelProps> = ({ scene, onUpdate }) => {
  const { showSuccess } = useToast();
  const [activeTab, setActiveTab] = useState(0);
  const [shots, setShots] = useState<string[]>(['Shot 1']);
  const [selectedShot, setSelectedShot] = useState('Shot 1');
  
  // Shot data states
  const [cameraData, setCameraData] = useState<Map<string, ShotCamera>>(new Map());
  const [lightingData, setLightingData] = useState<Map<string, ShotLighting>>(new Map());
  const [audioData, setAudioData] = useState<Map<string, ShotAudio>>(new Map());
  const [notesData, setNotesData] = useState<Map<string, ShotNote[]>>(new Map());

  const handleAddShot = () => {
    const newShotNum = `Shot ${shots.length + 1}`;
    setShots([...shots, newShotNum]);
    setSelectedShot(newShotNum);
    
    // Initialize data for new shot
    initializeShotData(newShotNum);
  };

  const initializeShotData = (shotNum: string) => {
    setCameraData(prev => new Map(prev).set(shotNum, {
      id: `camera-${Date.now()}`,
      shotNumber: shotNum,
      focalLength: 50,
      cameraType: 'ARRI Alexa',
      lensType: 'Prime',
      movement: 'Static',
      framing: 'Medium',
      angle: 'Eye-level',
    }));

    setLightingData(prev => new Map(prev).set(shotNum, {
      id: `lighting-${Date.now()}`,
      shotNumber: shotNum,
      keyLight: { direction: 'Front-left 45°', intensity: 80, color: '#FFFFFF' },
      fillLight: { direction: 'Front-right', intensity: 40, color: '#FFFFFF' },
      rimLight: { direction: 'Back', intensity: 60, color: '#FFFFFF' },
      practicals: [],
      colorTemp: 5600,
      lightingStyle: 'Natural',
    }));

    setAudioData(prev => new Map(prev).set(shotNum, {
      id: `audio-${Date.now()}`,
      shotNumber: shotNum,
      dialogueType: 'Sync',
      atmosphereNeeded: [],
      foleyNeeded: [],
      micSetup: 'Boom',
    }));

    setNotesData(prev => new Map(prev).set(shotNum, []));
  };

  // Initialize first shot
  useEffect(() => {
    initializeShotData('Shot 1');
  }, []);

  // Sync shot data back to parent scene whenever it changes
  useEffect(() => {
    // Only sync if we have data
    if (cameraData.size === 0 && lightingData.size === 0 && audioData.size === 0 && notesData.size === 0) {
      return;
    }

    // Convert Maps to arrays for storage in scene metadata
    const shotDetails = {
      shots,
      cameras: Object.fromEntries(cameraData),
      lighting: Object.fromEntries(lightingData),
      audio: Object.fromEntries(audioData),
      notes: Object.fromEntries(
        Array.from(notesData.entries()).map(([key, value]) => [key, value])
      ),
    };

    // Update scene with shot details
    const updatedScene: SceneBreakdown = {
      ...scene,
      metadata: {
        ...scene.metadata,
        shotDetails,
      },
    };

    onUpdate(updatedScene);
  }, [shots, cameraData, lightingData, audioData, notesData]);

  // Load shot data from scene metadata on mount
  useEffect(() => {
    const shotDetails = scene.metadata?.shotDetails as {
      shots?: string[];
      cameras?: Record<string, ShotCamera>;
      lighting?: Record<string, ShotLighting>;
      audio?: Record<string, ShotAudio>;
      notes?: Record<string, ShotNote[]>;
    } | undefined;

    if (shotDetails) {
      if (shotDetails.shots) {
        setShots(shotDetails.shots);
        setSelectedShot(shotDetails.shots[0] || 'Shot 1');
      }
      if (shotDetails.cameras) {
        setCameraData(new Map(Object.entries(shotDetails.cameras)));
      }
      if (shotDetails.lighting) {
        setLightingData(new Map(Object.entries(shotDetails.lighting)));
      }
      if (shotDetails.audio) {
        setAudioData(new Map(Object.entries(shotDetails.audio)));
      }
      if (shotDetails.notes) {
        setNotesData(new Map(Object.entries(shotDetails.notes)));
      }
    }
  }, [scene.id]); // Only reload when scene changes

  const currentCamera = cameraData.get(selectedShot);
  const currentLighting = lightingData.get(selectedShot);
  const currentAudio = audioData.get(selectedShot);
  const currentNotes = notesData.get(selectedShot) || [];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ContextualNudgeBanner context="shot-detail" accentColor="#8b5cf6" />
      {/* Shot Selector */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="subtitle2">Scene {scene.sceneNumber} - Shots:</Typography>
          <Stack direction="row" spacing={1} sx={{ flex: 1, flexWrap: 'wrap', gap: 1 }}>
            {shots.map(shot => (
              <Chip
                key={shot}
                label={shot}
                onClick={() => setSelectedShot(shot)}
                color={selectedShot === shot ? 'primary' : 'default'}
                variant={selectedShot === shot ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
          <Button startIcon={<AddIcon />} size="small" onClick={handleAddShot}>
            Ny Shot
          </Button>
        </Stack>
      </Paper>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<VideocamIcon />} label="Kamera" />
        <Tab icon={<LightbulbIcon />} label="Lys" />
        <Tab icon={<MicIcon />} label="Lyd" />
        <Tab icon={<NoteIcon />} label="Notater" />
      </Tabs>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* Camera Tab */}
        {activeTab === 0 && currentCamera && (
          <CameraTab
            data={currentCamera}
            onChange={(updated) => {
              setCameraData(prev => new Map(prev).set(selectedShot, updated));
              showSuccess('Kamera oppdatert');
            }}
          />
        )}

        {/* Lighting Tab */}
        {activeTab === 1 && currentLighting && (
          <LightingTab
            data={currentLighting}
            onChange={(updated) => {
              setLightingData(prev => new Map(prev).set(selectedShot, updated));
              showSuccess('Lys oppdatert');
            }}
          />
        )}

        {/* Audio Tab */}
        {activeTab === 2 && currentAudio && (
          <AudioTab
            data={currentAudio}
            onChange={(updated) => {
              setAudioData(prev => new Map(prev).set(selectedShot, updated));
              showSuccess('Lyd oppdatert');
            }}
          />
        )}

        {/* Notes Tab */}
        {activeTab === 3 && (
          <NotesTab
            notes={currentNotes}
            onChange={(updated) => {
              setNotesData(prev => new Map(prev).set(selectedShot, updated));
              showSuccess('Notater oppdatert');
            }}
          />
        )}
      </Box>
    </Box>
  );
};

const CameraTab: React.FC<{ data: ShotCamera; onChange: (data: ShotCamera) => void }> = ({ data, onChange }) => {
  return (
    <Stack spacing={3}>
      <Typography variant="h6">Kamera Setup</Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Kameratype"
            value={data.cameraType}
            onChange={(e) => onChange({ ...data, cameraType: e.target.value })}
            fullWidth
            select
          >
            <MenuItem value="ARRI Alexa">ARRI Alexa</MenuItem>
            <MenuItem value="RED Komodo">RED Komodo</MenuItem>
            <MenuItem value="Sony Venice">Sony Venice</MenuItem>
            <MenuItem value="Blackmagic URSA">Blackmagic URSA</MenuItem>
            <MenuItem value="Canon C300">Canon C300</MenuItem>
          </TextField>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Linsetype"
            value={data.lensType}
            onChange={(e) => onChange({ ...data, lensType: e.target.value })}
            fullWidth
            select
          >
            <MenuItem value="Prime">Prime</MenuItem>
            <MenuItem value="Zoom">Zoom</MenuItem>
            <MenuItem value="Anamorphic">Anamorphic</MenuItem>
          </TextField>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Typography gutterBottom>Brennvidde: {data.focalLength}mm</Typography>
          <Slider
            value={data.focalLength}
            onChange={(_, v) => onChange({ ...data, focalLength: v as number })}
            min={8}
            max={200}
            marks={[
              { value: 8, label: '8mm' },
              { value: 24, label: '24mm' },
              { value: 50, label: '50mm' },
              { value: 85, label: '85mm' },
              { value: 200, label: '200mm' },
            ]}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth>
            <InputLabel>Bevegelse</InputLabel>
            <Select
              value={data.movement}
              onChange={(e) => onChange({ ...data, movement: e.target.value })}
            >
              <MenuItem value="Static">Static</MenuItem>
              <MenuItem value="Pan">Pan</MenuItem>
              <MenuItem value="Tilt">Tilt</MenuItem>
              <MenuItem value="Dolly">Dolly</MenuItem>
              <MenuItem value="Tracking">Tracking</MenuItem>
              <MenuItem value="Steadicam">Steadicam</MenuItem>
              <MenuItem value="Handheld">Handheld</MenuItem>
              <MenuItem value="Crane">Crane</MenuItem>
              <MenuItem value="Drone">Drone</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth>
            <InputLabel>Framing</InputLabel>
            <Select
              value={data.framing}
              onChange={(e) => onChange({ ...data, framing: e.target.value })}
            >
              <MenuItem value="Extreme Wide">Extreme Wide</MenuItem>
              <MenuItem value="Wide">Wide</MenuItem>
              <MenuItem value="Medium Wide">Medium Wide</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="Medium Close">Medium Close</MenuItem>
              <MenuItem value="Close-up">Close-up</MenuItem>
              <MenuItem value="ECU">Extreme Close-up</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth>
            <InputLabel>Vinkel</InputLabel>
            <Select
              value={data.angle}
              onChange={(e) => onChange({ ...data, angle: e.target.value })}
            >
              <MenuItem value="Eye-level">Eye-level</MenuItem>
              <MenuItem value="High">High Angle</MenuItem>
              <MenuItem value="Low">Low Angle</MenuItem>
              <MenuItem value="Dutch">Dutch Angle</MenuItem>
              <MenuItem value="Bird's Eye">Bird's Eye</MenuItem>
              <MenuItem value="Worm's Eye">Worm's Eye</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TextField
            label="Notater"
            value={data.notes || ''}
            onChange={(e) => onChange({ ...data, notes: e.target.value })}
            multiline
            rows={3}
            fullWidth
            placeholder="Spesielle instruksjoner, referanser, etc."
          />
        </Grid>
      </Grid>
    </Stack>
  );
};

const LightingTab: React.FC<{ data: ShotLighting; onChange: (data: ShotLighting) => void }> = ({ data, onChange }) => {
  return (
    <Stack spacing={3}>
      <Typography variant="h6">Lysoppsett</Typography>

      {/* Key Light */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Key Light (Hovedlys)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TextField
              label="Retning"
              value={data.keyLight.direction}
              onChange={(e) => onChange({
                ...data,
                keyLight: { ...data.keyLight, direction: e.target.value }
              })}
              fullWidth
            />
            <Box>
              <Typography gutterBottom>Intensitet: {data.keyLight.intensity}%</Typography>
              <Slider
                value={data.keyLight.intensity}
                onChange={(_, v) => onChange({
                  ...data,
                  keyLight: { ...data.keyLight, intensity: v as number }
                })}
                min={0}
                max={100}
              />
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Fill Light */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Fill Light (Fyllys)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TextField
              label="Retning"
              value={data.fillLight.direction}
              onChange={(e) => onChange({
                ...data,
                fillLight: { ...data.fillLight, direction: e.target.value }
              })}
              fullWidth
            />
            <Box>
              <Typography gutterBottom>Intensitet: {data.fillLight.intensity}%</Typography>
              <Slider
                value={data.fillLight.intensity}
                onChange={(_, v) => onChange({
                  ...data,
                  fillLight: { ...data.fillLight, intensity: v as number }
                })}
                min={0}
                max={100}
              />
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Rim Light */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Rim Light (Baklys)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TextField
              label="Retning"
              value={data.rimLight.direction}
              onChange={(e) => onChange({
                ...data,
                rimLight: { ...data.rimLight, direction: e.target.value }
              })}
              fullWidth
            />
            <Box>
              <Typography gutterBottom>Intensitet: {data.rimLight.intensity}%</Typography>
              <Slider
                value={data.rimLight.intensity}
                onChange={(_, v) => onChange({
                  ...data,
                  rimLight: { ...data.rimLight, intensity: v as number }
                })}
                min={0}
                max={100}
              />
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Fargetemperatur (K)"
            type="number"
            value={data.colorTemp}
            onChange={(e) => onChange({ ...data, colorTemp: parseInt(e.target.value) })}
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth>
            <InputLabel>Lysstil</InputLabel>
            <Select
              value={data.lightingStyle}
              onChange={(e) => onChange({ ...data, lightingStyle: e.target.value })}
            >
              <MenuItem value="Natural">Natural</MenuItem>
              <MenuItem value="Dramatic">Dramatic</MenuItem>
              <MenuItem value="High-key">High-key</MenuItem>
              <MenuItem value="Low-key">Low-key</MenuItem>
              <MenuItem value="Noir">Film Noir</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Stack>
  );
};

const AudioTab: React.FC<{ data: ShotAudio; onChange: (data: ShotAudio) => void }> = ({ data, onChange }) => {
  return (
    <Stack spacing={3}>
      <Typography variant="h6">Lydoppsett</Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth>
            <InputLabel>Dialog Type</InputLabel>
            <Select
              value={data.dialogueType}
              onChange={(e) => onChange({ ...data, dialogueType: e.target.value })}
            >
              <MenuItem value="Sync">Sync Sound</MenuItem>
              <MenuItem value="ADR">ADR (Dubbing)</MenuItem>
              <MenuItem value="Voice-over">Voice-over</MenuItem>
              <MenuItem value="None">Ingen Dialog</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth>
            <InputLabel>Mikrofon Setup</InputLabel>
            <Select
              value={data.micSetup}
              onChange={(e) => onChange({ ...data, micSetup: e.target.value })}
            >
              <MenuItem value="Boom">Boom</MenuItem>
              <MenuItem value="Lav">Lavalier</MenuItem>
              <MenuItem value="Plant">Plant Mic</MenuItem>
              <MenuItem value="Wireless">Wireless</MenuItem>
              <MenuItem value="Combo">Boom + Lav</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TextField
            label="Atmosfære (kommadelt)"
            value={data.atmosphereNeeded.join(', ')}
            onChange={(e) => onChange({
              ...data,
              atmosphereNeeded: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
            })}
            fullWidth
            placeholder="Traffic, birds, wind, rain..."
            helperText="Liste med atmosfære-lyder som trengs"
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TextField
            label="Foley (kommadelt)"
            value={data.foleyNeeded.join(', ')}
            onChange={(e) => onChange({
              ...data,
              foleyNeeded: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
            })}
            fullWidth
            placeholder="Footsteps, door close, glass clink..."
            helperText="Liste med foley-effekter som trengs"
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TextField
            label="Musikk Cue"
            value={data.musicCue || ''}
            onChange={(e) => onChange({ ...data, musicCue: e.target.value })}
            fullWidth
            placeholder="Track name eller beskrivelse"
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TextField
            label="Lydnotater"
            value={data.notes || ''}
            onChange={(e) => onChange({ ...data, notes: e.target.value })}
            multiline
            rows={3}
            fullWidth
          />
        </Grid>
      </Grid>
    </Stack>
  );
};

const NotesTab: React.FC<{ notes: ShotNote[]; onChange: (notes: ShotNote[]) => void }> = ({ notes, onChange }) => {
  const [newNote, setNewNote] = useState({ category: 'Director', content: '', priority: 'medium' as const });

  const handleAddNote = () => {
    if (!newNote.content.trim()) return;

    const note: ShotNote = {
      id: `note-${Date.now()}`,
      shotNumber: '',
      category: newNote.category,
      content: newNote.content,
      priority: newNote.priority,
      resolved: false,
      createdAt: new Date().toISOString(),
    };

    onChange([...notes, note]);
    setNewNote({ category: 'Director', content: '', priority: 'medium' });
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Shot Notater</Typography>

      {/* Add Note */}
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Kategori</InputLabel>
                  <Select
                    value={newNote.category}
                    onChange={(e) => setNewNote({ ...newNote, category: e.target.value })}
                  >
                    <MenuItem value="Director">Regi</MenuItem>
                    <MenuItem value="VFX">VFX</MenuItem>
                    <MenuItem value="Continuity">Continuity</MenuItem>
                    <MenuItem value="Performance">Performance</MenuItem>
                    <MenuItem value="Technical">Teknisk</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Prioritet</InputLabel>
                  <Select
                    value={newNote.priority}
                    onChange={(e) => setNewNote({ ...newNote, priority: e.target.value as ShotNote['priority'] })}
                  >
                    <MenuItem value="low">Lav</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">Høy</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <TextField
              value={newNote.content}
              onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
              placeholder="Skriv notat..."
              multiline
              rows={2}
              fullWidth
            />
            <Button variant="contained" onClick={handleAddNote} startIcon={<AddIcon />}>
              Legg til Notat
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Notes List */}
      <Stack spacing={2}>
        {notes.map((note) => (
          <Card key={note.id} variant="outlined">
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={note.category} size="small" />
                  <Chip
                    label={note.priority}
                    size="small"
                    color={note.priority === 'high' ? 'error' : note.priority === 'medium' ? 'warning' : 'default'}
                  />
                  {note.resolved && <Chip label="Løst" size="small" color="success" />}
                </Stack>
                <Typography variant="body2">{note.content}</Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    onClick={() => onChange(notes.map(n => n.id === note.id ? { ...n, resolved: !n.resolved } : n))}
                  >
                    {note.resolved ? 'Gjenåpne' : 'Marker som løst'}
                  </Button>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => onChange(notes.filter(n => n.id !== note.id))}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
};
