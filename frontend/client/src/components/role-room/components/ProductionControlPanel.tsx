import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Divider,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  IconButton,
  TextField,
  Button,
  Grid,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  Lightbulb as LightbulbIcon,
  Mic as MicIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  Add as AddIcon,
  PersonOutline as PersonIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { LocationsIcon as LocationIcon } from './icons/CastingIcons';
import { SceneBreakdown } from '../models/casting';

interface ProductionControlPanelProps {
  selectedScene?: SceneBreakdown;
  selectedShot?: string;
  onClose: () => void;
}

export const ProductionControlPanel: React.FC<ProductionControlPanelProps> = ({
  selectedScene,
  selectedShot,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState(0);

  if (!selectedScene && !selectedShot) {
    return (
      <Paper sx={{ p: 3, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary" align="center">
          Velg en scene eller shot for å se produksjonsdetaljer
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6">Produksjonskontroll</Typography>
            {selectedScene && (
              <Typography variant="caption" color="text.secondary">
                Scene {selectedScene.sceneNumber} {selectedShot ? `- ${selectedShot}` : ''}
              </Typography>
            )}
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </Paper>

      {/* Scene Overview */}
      {selectedScene && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
              <LocationIcon color="primary" />
              <Box flex={1}>
                <Typography variant="caption" color="text.secondary">Lokasjon</Typography>
                <Typography variant="body2">{selectedScene.locationName || 'Ikke satt'}</Typography>
              </Box>
            </Stack>
            
            <Stack direction="row" spacing={2}>
              <Chip label={selectedScene.intExt} size="small" />
              <Chip label={selectedScene.timeOfDay} size="small" />
              {selectedScene.estimatedDuration && (
                <Chip icon={<ScheduleIcon />} label={`${selectedScene.estimatedDuration} min`} size="small" />
              )}
            </Stack>

            {selectedScene.characters && selectedScene.characters.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">Karakterer i scenen</Typography>
                <Stack direction="row" spacing={0.5} mt={0.5} flexWrap="wrap">
                  {selectedScene.characters.map((char, i) => (
                    <Chip key={i} label={char} size="small" icon={<PersonIcon />} />
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Paper>
      )}

      {/* Tabs for Shot Details */}
      {selectedShot && (
        <>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab icon={<VideocamIcon />} label="Kamera" />
            <Tab icon={<LightbulbIcon />} label="Lys" />
            <Tab icon={<MicIcon />} label="Lyd" />
            <Tab icon={<ImageIcon />} label="Referanser" />
          </Tabs>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {/* Camera Tab */}
            {activeTab === 0 && <CameraControlPanel />}

            {/* Lighting Tab */}
            {activeTab === 1 && <LightingControlPanel />}

            {/* Audio Tab */}
            {activeTab === 2 && <AudioControlPanel />}

            {/* References Tab */}
            {activeTab === 3 && <ReferencesPanel />}
          </Box>
        </>
      )}
    </Box>
  );
};

const CameraControlPanel: React.FC = () => {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">Kamera Setup</Typography>

      <Card variant="outlined">
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">Brennvidde</Typography>
              <Typography variant="h6">50mm</Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">Kameratype</Typography>
              <Typography variant="body2">ARRI Alexa</Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">Bevegelse</Typography>
              <Typography variant="body2">Dolly</Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">Framing</Typography>
              <Typography variant="body2">Medium</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
        Foreslåtte innstillinger:
      </Typography>
      
      <List dense>
        <ListItem>
          <ListItemText
            primary="F-stop: f/2.8"
            secondary="For god dybdeskarphet på denne brennvidden"
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Shutter: 1/50"
            secondary="Standard 180° shutter for 24fps"
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="ISO: 800"
            secondary="Optimal for innendørs med supplerende lys"
          />
        </ListItem>
      </List>
    </Stack>
  );
};

const LightingControlPanel: React.FC = () => {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">Lysoppsett</Typography>

      {/* Key Light */}
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <LightbulbIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2">Key Light</Typography>
            </Stack>
            <Grid container spacing={1}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">Retning</Typography>
                <Typography variant="body2">Front-left 45°</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">Intensitet</Typography>
                <Typography variant="body2">80%</Typography>
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      {/* Fill Light */}
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <LightbulbIcon color="action" fontSize="small" />
              <Typography variant="subtitle2">Fill Light</Typography>
            </Stack>
            <Grid container spacing={1}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">Retning</Typography>
                <Typography variant="body2">Front-right</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">Intensitet</Typography>
                <Typography variant="body2">40%</Typography>
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      {/* Rim Light */}
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <LightbulbIcon sx={{ color: 'warning.main' }} fontSize="small" />
              <Typography variant="subtitle2">Rim Light</Typography>
            </Stack>
            <Grid container spacing={1}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">Retning</Typography>
                <Typography variant="body2">Back</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">Intensitet</Typography>
                <Typography variant="body2">60%</Typography>
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      <Divider sx={{ my: 2 }} />

      <Stack direction="row" spacing={2}>
        <Box flex={1}>
          <Typography variant="caption" color="text.secondary">Fargetemperatur</Typography>
          <Typography variant="body2">5600K</Typography>
        </Box>
        <Box flex={1}>
          <Typography variant="caption" color="text.secondary">Stil</Typography>
          <Typography variant="body2">Natural</Typography>
        </Box>
      </Stack>
    </Stack>
  );
};

const AudioControlPanel: React.FC = () => {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">Lydoppsett</Typography>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">Dialog</Typography>
              <Typography variant="body2">Sync Sound</Typography>
            </Box>
            
            <Box>
              <Typography variant="caption" color="text.secondary">Mikrofon Setup</Typography>
              <Typography variant="body2">Boom + Lav</Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary">Atmosfære</Typography>
      <Stack direction="row" spacing={0.5} flexWrap="wrap">
        <Chip label="Traffic ambiance" size="small" />
        <Chip label="Birds" size="small" />
      </Stack>

      <Typography variant="caption" color="text.secondary">Foley</Typography>
      <Stack direction="row" spacing={0.5} flexWrap="wrap">
        <Chip label="Footsteps" size="small" />
        <Chip label="Door close" size="small" />
      </Stack>
    </Stack>
  );
};

const ReferencesPanel: React.FC = () => {
  const [images, setImages] = useState<string[]>([]);

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">Referansebilder & Mood</Typography>

      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        fullWidth
      >
        Last opp referanse
      </Button>

      <Grid container spacing={1}>
        {images.length === 0 ? (
          <Grid size={{ xs: 12 }}>
            <Paper
              sx={{
                p: 4,
                textAlign: 'center',
                bgcolor: 'action.hover',
                border: '2px dashed',
                borderColor: 'divider',
              }}
            >
              <ImageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Ingen referansebilder lagt til ennå
              </Typography>
            </Paper>
          </Grid>
        ) : (
          images.map((img, i) => (
            <Grid key={i} size={{ xs: 6 }}>
              <Card>
                <Box
                  component="img"
                  src={img}
                  sx={{
                    width: '100%',
                    height: 120,
                    objectFit: 'cover',
                  }}
                />
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <Divider />

      <Box>
        <Typography variant="caption" color="text.secondary">Mood Tags</Typography>
        <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap">
          <Chip label="Warm" size="small" color="warning" />
          <Chip label="Intimate" size="small" color="secondary" />
          <Chip label="Natural" size="small" color="success" />
        </Stack>
      </Box>

      <TextField
        label="Visuelle notater"
        multiline
        rows={3}
        placeholder="Beskrivelse av ønsket look, farge, stemning..."
        fullWidth
      />
    </Stack>
  );
};

export default ProductionControlPanel;
