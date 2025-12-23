import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  VideoLibrary,
  Download,
  AutoFixHigh,
  ColorLens,
  Folder,
  TrendingUp as TimelineIcon,
  ExpandMore,
  PlayArrow,
  Settings
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
// Toast removed - Zero Toast Compliance Policy

interface ResolveProject {
  projectName: string;
  clientName: string;
  eventType: 'bryllup' | 'bedrift' | 'musikkvideo' | 'dokumentar' | 'kommersial';
  cultureType?: string;
  frameRate: number;
  resolution: string;
  colorSpace: string;
  logFormat?: string
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`resolve-tabpanel-${index}`}
      aria-labelledby={`resolve-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

export default function ResolveProjectCreator() {
  const [tabValue, setTabValue] = useState(false);
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'videographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);
  const [project, setProject] = useState<ResolveProject>({
    projectName: '',
    clientName: '',
    eventType: 'bryllup',
    frameRate:  25,
    resolution: '1920x108',
    colorSpace: 'Rec.709'
});
  const [highlightSettings, setHighlightSettings] = useState({
    videoPath: ',',
    targetDuration: 180 });
  // Toast functionality removed for Material UI compliance

  // Hent tilgjengelige templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/davinci-resolve/templates']
});

  // Generer story arc
  const generateStoryArc = useMutation({
    mutationFn: async (data: { eventType: string; cultureType?: string; duration: number }) => {
      return apiRequest('/api/davinci-resolve/story-arc', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
    // Toast notification removed for Zero Toast Policy
}
});

  // Opprett prosjekt
  const createProject = useMutation({
    mutationFn: async (data: ResolveProject) => {
      return apiRequest('/api/davinci-resolve/create-project', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
    // Toast notification removed for Zero Toast Policy
}
});

  // Last ned komplett pakke
  const downloadPackage = useMutation({
    mutationFn: async (data: ResolveProject) => {
      const response = await fetch('/api/davinci-resolve/download-package', {
        headers: {
            ...auth,
            'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(data)
  });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.projectName}_DaVinci_Package.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
  },
    onSuccess: () => {
    // Toast notification removed for Zero Toast Policy
}
});

  // Generer intelligent highlight
  const generateHighlight = useMutation({
    mutationFn: async (data: { 
      videoPath: string; 
      eventType: string; 
      cultureType?: string; 
      targetDuration: number 
}) => {
      return apiRequest('/api/davinci-resolve/generate-highlight', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: JSON.stringify(data)
  });
  },
    onSuccess: () => {
    // Toast notification removed for Zero Toast Policy
}
});

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
};

  if (templatesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} sx={{ color: '#ff8c00' }} />
        <Typography variant="h6" sx={{ ml: 2, color: theming.colors.primary }}>
          Laster DaVinci Resolve templates...
        </Typography>
      </Box>
    );
  }

  return (
    <MuiCard sx={{
      background: 'rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(15px)',
      border: '1px solid rgba(255, 140, 0, 0.3)',
      borderRadius: '12px'
    }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          {professionIcon && (
            <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center', mr: 1 }}>
              {professionIcon}
            </Box>
          )}
          <VideoLibrary sx={{ color: '#ff8c00', fontSize: 32, mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
            {enhancedProfessionConfig?.displayName || professionConfig?.displayName
              ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - DaVinci Resolve Integration`
              : 'DaVinci Resolve Integration'}
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Opprett pre-konfigurerte DaVinci Resolve prosjekter med intelligent story arc generering,
          DPX fargekorrigering, og kulturspesifikke templates.
        </Alert>

        <Paper sx={{ width: '100%', ...theming.getThemedCardSx() }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              borderBottom: 1,
              borderColor: 'divider','& .MuiTab-root': {
                color: '#666','&.Mui-selected': {
                  color: '#ff8c00',
                  fontWeight: 'bold'
                }
              }
            }}
          >
            <Tab
              icon={theming.getThemedIcon('settings')}
              label="Prosjekt Oppsett"
              id="resolve-tab-0"
              aria-controls="resolve-tabpanel-0"
            />
            <Tab
              icon={theming.getThemedIcon('autoFixHigh')}
              label="Intelligent Highlight"
              id="resolve-tab-1"
              aria-controls="resolve-tabpanel-1"
            />
            <Tab
              icon={<ColorLens />}
              label="DPX & Farge"
              id="resolve-tab-2"
              aria-controls="resolve-tabpanel-2"
            />
          </Tabs>

          {/* Prosjekt Oppsett Tab */}
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }} md={6}>
                <TextField
                  fullWidth
                  label="Prosjektnavn"
                  value={project.projectName}
                  onChange={(e) => setProject({ ...project, projectName: e.target.value })}
                  sx={{ mb:  2 }}
                />
                
                <TextField
                  fullWidth
                  label="Klientnavn"
                  value={project.clientName}
                  onChange={(e) => setProject({ ...project, clientName: e.target.value })}
                  sx={{ mb:  2 }}
                />

                <FormControl fullWidth sx={{ mb:  2 }}>
                  <InputLabel>Event Type</InputLabel>
                  <Select
                    value={project.eventType}
                    label="Event Type"
                    onChange={(e) => setProject({ ...project, eventType: e.target.value as any })}
                  >
                    {templates?.templates.eventTypes.map((type: any) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {project.eventType === 'bryllup' && (
                  <FormControl fullWidth sx={{ mb:  2 }}>
                    <InputLabel>Kultur</InputLabel>
                    <Select
                      value={project.cultureType || ', '}
                      label="Kultur"
                      onChange={(e) => setProject({ ...project, cultureType: e.target.value })}
                    >
                      <MenuItem value="">Ingen spesiell kultur</MenuItem>
                      {templates?.templates.eventTypes
                        .find((t: any) => t.value === 'bryllup')?.cultures
                        ?.map((culture: string) => (
                          <MenuItem key={culture} value={culture}>
                            {culture.charAt(0).toUpperCase() + culture.slice(1)}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                )}
              </Grid>

              <Grid size={{ xs: 12 }} md={6}>
                <FormControl fullWidth sx={{ mb:  2 }}>
                  <InputLabel>Frame Rate</InputLabel>
                  <Select
                    value={project.frameRate}
                    label="Frame Rate"
                    onChange={(e) => setProject({ ...project, frameRate: Number(e.target.value, ),})}
                  >
                    {templates?.templates.frameRates.map((rate: number) => (
                      <MenuItem key={rate} value={rate}>
                        {rate} fps
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb:  2 }}>
                  <InputLabel>Oppløsning</InputLabel>
                  <Select
                    value={project.resolution}
                    label="Oppløsning"
                    onChange={(e) => setProject({ ...project, resolution: e.target.value })}
                  >
                    {templates?.templates.resolutions.map((res: string) => (
                      <MenuItem key={res} value={res}>
                        {res}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb:  2 }}>
                  <InputLabel>Color Space</InputLabel>
                  <Select
                    value={project.colorSpace}
                    label="Color Space"
                    onChange={(e) => setProject({ ...project, colorSpace: e.target.value })}
                  >
                    {templates?.templates.colorSpaces.map((space: string) => (
                      <MenuItem key={space} value={space}>
                        {space}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb:  2 }}>
                  <InputLabel>Log Format (valgfritt)</InputLabel>
                  <Select
                    value={project.logFormat || ', '}
                    label="Log Format"
                    onChange={(e) => setProject({ ...project, logFormat: e.target.value })}
                  >
                    <MenuItem value="">Ingen log format</MenuItem>
                    {templates?.templates.logFormats.map((format: string) => (
                      <MenuItem key={format} value={format}>
                        {format}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Accordion sx={{ mt: 3 }}>
              <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
                  <TimelineIcon sx={{ mr: 1 }} />
                  Story Arc Forhåndsvisning
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Button
                  variant="outlined"
                  onClick={() => generateStoryArc.mutate({
                    eventType: project.eventType,
                    cultureType: project.cultureType,
                    duration: 300 })}
                  disabled={generateStoryArc.isPending}
                  sx={{ mb:  2 }}
                >
                  {generateStoryArc.isPending ? (
                    <CircularProgress size={20} sx={{ mr:  1 }} />
                  ) : (
                    <AutoFixHigh sx={{ mr:  1 }} />
                  )}
                  Generer Story Arc
                </Button>

                {generateStoryArc.data && (
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>
                      Story Segmenter: </Typography>
                    {generateStoryArc.data.storyArc.segments.map((segment: any, index: number) => (
                      <Chip
                        key={index}
                        label={`${segment.name} (${segment.estimatedDuration}s)`}
                        sx={{ mr: 1, mb: 1 }}
                        color="primary"
                      />
                    ))}
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                onClick={() => createProject.mutate(project)}
                disabled={createProject.isPending || !project.projectName || !project.clientName}
                sx={{
                  ...theming.getThemedButtonSx(),
                  backgroundColor: '#ff8c00',
                  '&:hover': { backgroundColor: '#e67e00' }
                }}
              >
                {createProject.isPending ? (
                  <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                ) : (
                  <Folder sx={{ mr: 1 }} />
                )}
                Opprett Prosjekt
              </Button>

              <Button
                variant="outlined"
                onClick={() => downloadPackage.mutate(project)}
                disabled={downloadPackage.isPending || !project.projectName || !project.clientName}
              >
                {downloadPackage.isPending ? (
                  <CircularProgress size={20} sx={{ mr:  1 }} />
                ) : (
                  <Download sx={{ mr:  1 }} />
                )}
                Last ned komplett pakke
              </Button>
            </Box>
          </TabPanel>

          {/* Intelligent Highlight Tab */}
          <TabPanel value={tabValue} index={1}>
            <Alert severity="success" sx={{ mb:  3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🎯 Intelligent Highlight Generering
              </Typography>
              Systemet analyserer lang film og finner automatisk høydepunkter basert på:
              <br />• Audio-peaks (applaus, latter, musikk)
              <br />• Bevegelsesdeteksjon og scene-endringer  
              <br />• Ansiktsuttrykk og følelser
              <br />• Kulturspesifikke øyeblikk
            </Alert>

            <TextField
              fullWidth
              label="Video filbane (full film)"
              value={highlightSettings.videoPath}
              onChange={(e) => setHighlightSettings({ ...highlightSettings, videoPath: e.target.value })}
              placeholder="/path/to/full-wedding-video.mp4"
              sx={{ mb:  2 }}
            />

            <FormControl sx={{ mb:  3, minWidth: 200}}>
              <InputLabel>Highlight lengde</InputLabel>
              <Select
                value={highlightSettings.targetDuration}
                label="Highlight lengde"
                onChange={(e) => setHighlightSettings({ ...highlightSettings, targetDuration: Number(e.target.value, ),})}
              >
                {templates?.templates.highlightTypes?.map((type: any) => (
                  <MenuItem key={type.value} value={type.duration}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              size="large"
              onClick={() => generateHighlight.mutate({
                videoPath: highlightSettings.videoPath,
                eventType: project.eventType,
                cultureType: project.cultureType,
                targetDuration: highlightSettings.targetDuration
              })}
              disabled={generateHighlight.isPending || !highlightSettings.videoPath}
              sx={{
                ...theming.getThemedButtonSx(),
                backgroundColor: '#ff8c00', '&:hover': { backgroundColor: '#e67e00' },
                py: 2,
                px: 4
              }}
            >
              {generateHighlight.isPending ? (
                <CircularProgress size={24} sx={{ mr: 2, color: 'white' }} />
              ) : (
                <PlayArrow sx={{ mr: 2, fontSize: 28 }} />
              )}
              Generer Intelligent Highlight
            </Button>

            {generateHighlight.data && (
              <Alert severity="success" sx={{ mt:  3 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Highlight generert! 
                </Typography>
                <Typography>
                  {generateHighlight.data.message}
                </Typography>
                <Typography variant="body2" sx={{ mt:  1 }}>
                  XML fil: {generateHighlight.data.xmlPath}
                </Typography>
              </Alert>
            )}
          </TabPanel>

          {/* DPX & Farge Tab */}
          <TabPanel value={tabValue} index={2}>
            <Alert severity="info" sx={{ mb:  3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🎨 DPX Fargekorrigering
              </Typography>
              Automatisk fargekorrigering for Canon C-log 2/3 og andre log-formater.
              Systemet genererer optimaliserte LUT-filer og fargeprofiler.
            </Alert>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }} md={6}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Støttede Log-formater: </Typography>
                {templates?.templates.logFormats.map((format: string) => (
                  <Chip
                    key={format}
                    label={format}
                    sx={{ mr: 1, mb: 1 }}
                    color={project.logFormat === format ? 'primary' : 'default'}
                  />
                ))}
              </Grid>

              <Grid size={{ xs: 12 }} md={6}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Automatiske justeringer: </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2">• Gamma-korreksjon</Typography>
                  <Typography variant="body2">• Lift/Gamma/Gain balansering</Typography>
                  <Typography variant="body2">• LUT-basert konvertering</Typography>
                  <Typography variant="body2">• Kulturspesifikke fargetoner</Typography>
                </Box>
              </Grid>
            </Grid>

            {project.logFormat && (
              <Alert severity="success" sx={{ mt:  3 }}>
                <Typography>
                  <strong>{project.logFormat}</strong> fargekorrigering vil være inkludert i prosjektpakken.
                </Typography>
              </Alert>
            )}
          </TabPanel>
        </Paper>
      </CardContent>
    </MuiCard>
  );
}