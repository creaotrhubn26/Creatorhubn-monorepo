// @ts-nocheck
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
import type { SceneBreakdown } from '../models/casting';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import { useT } from '../../../i18n';

interface ProductionControlPanelProps {
  selectedScene?: SceneBreakdown;
  selectedShot?: string;
  onClose: () => void;
}

const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
  const current = typeof sourceText === 'string' ? sourceText : '';
  if (!current.trim()) return name;
  const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
  return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
};

export const ProductionControlPanel: React.FC<ProductionControlPanelProps> = ({
  selectedScene,
  selectedShot,
  onClose,
}) => {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState(0);

  if (!selectedScene && !selectedShot) {
    return (
      <Paper sx={{ p: 3, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary" align="center">
          {t('prodctrl.selectScenePrompt')}
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
            <Typography variant="h6">{t('prodctrl.title')}</Typography>
            {selectedScene && (
              <Typography variant="caption" color="text.secondary">
                Scene {selectedScene.sceneNumber} {selectedShot ? `- ${selectedShot}` : ''}
              </Typography>
            )}
          </Box>
          <IconButton size="small" onClick={onClose} aria-label={t('prodctrl.close')}>
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
                <Typography variant="caption" color="text.secondary">{t('prodctrl.location')}</Typography>
                <Typography variant="body2">{selectedScene.locationName || t('prodctrl.notSet')}</Typography>
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
                <Typography variant="caption" color="text.secondary">{t('prodctrl.charactersInScene')}</Typography>
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
            <Tab icon={<VideocamIcon />} label={t('prodctrl.tabCamera')} />
            <Tab icon={<LightbulbIcon />} label={t('prodctrl.tabLight')} />
            <Tab icon={<MicIcon />} label={t('prodctrl.tabAudio')} />
            <Tab icon={<ImageIcon />} label={t('prodctrl.tabReferences')} />
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
  const { t } = useT();
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">{t('prodctrl.cameraSetup')}</Typography>

      <Card variant="outlined">
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">{t('prodctrl.focalLength')}</Typography>
              <Typography variant="h6">50mm</Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">{t('prodctrl.cameraType')}</Typography>
              <Typography variant="body2">ARRI Alexa</Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">{t('prodctrl.movement')}</Typography>
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
        {t('prodctrl.suggestedSettings')}
      </Typography>
      
      <List dense>
        <ListItem>
          <ListItemText
            primary="F-stop: f/2.8"
            secondary={t('prodctrl.hintFstop')}
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
            secondary={t('prodctrl.hintIso')}
          />
        </ListItem>
      </List>
    </Stack>
  );
};

const LightingControlPanel: React.FC = () => {
  const { t } = useT();
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">{t('prodctrl.lightingSetup')}</Typography>

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
                <Typography variant="caption" color="text.secondary">{t('prodctrl.direction')}</Typography>
                <Typography variant="body2">Front-left 45°</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">{t('prodctrl.intensity')}</Typography>
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
                <Typography variant="caption" color="text.secondary">{t('prodctrl.direction')}</Typography>
                <Typography variant="body2">Front-right</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">{t('prodctrl.intensity')}</Typography>
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
                <Typography variant="caption" color="text.secondary">{t('prodctrl.direction')}</Typography>
                <Typography variant="body2">Back</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">{t('prodctrl.intensity')}</Typography>
                <Typography variant="body2">60%</Typography>
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      <Divider sx={{ my: 2 }} />

      <Stack direction="row" spacing={2}>
        <Box flex={1}>
          <Typography variant="caption" color="text.secondary">{t('prodctrl.colorTemp')}</Typography>
          <Typography variant="body2">5600K</Typography>
        </Box>
        <Box flex={1}>
          <Typography variant="caption" color="text.secondary">{t('prodctrl.style')}</Typography>
          <Typography variant="body2">Natural</Typography>
        </Box>
      </Stack>
    </Stack>
  );
};

const AudioControlPanel: React.FC = () => {
  const { t } = useT();
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">{t('prodctrl.audioSetup')}</Typography>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">Dialog</Typography>
              <Typography variant="body2">Sync Sound</Typography>
            </Box>
            
            <Box>
              <Typography variant="caption" color="text.secondary">{t('prodctrl.micSetup')}</Typography>
              <Typography variant="body2">Boom + Lav</Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary">{t('prodctrl.atmosphere')}</Typography>
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
  const { t } = useT();
  const [images, setImages] = useState<string[]>([]);
  const [visualNotes, setVisualNotes] = useState('');

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">{t('prodctrl.referencesTitle')}</Typography>

      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        fullWidth
      >
        {t('prodctrl.uploadReference')}
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
                {t('prodctrl.noReferences')}
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
        label={t('prodctrl.visualNotes')}
        multiline
        rows={3}
        placeholder={t('prodctrl.visualNotesPlaceholder')}
        value={visualNotes}
        onChange={(event) => setVisualNotes(event.target.value)}
        fullWidth
      />
      <GlobalMentionHelper
        text={visualNotes}
        localCandidates={['Regi', 'Foto', 'Lys', 'Colorist', 'Moodboard']}
        onApplySuggestion={(name) => setVisualNotes((prev) => applyMentionSuggestion(prev, name))}
        autoTagTitle={t('prodctrl.autoTagged')}
        suggestionTitle={t('prodctrl.didYouMean')}
      />
    </Stack>
  );
};

export default ProductionControlPanel;
