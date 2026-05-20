// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
} from '@mui/material';
import {
  Download,
  CameraAlt,
  Movie,
  Code,
  CheckCircle,
  ExpandMore,
  Info,
  Warning,
  GetApp,
  FilterList,
  Search,
  Refresh,
} from '@mui/icons-material';

interface CameraConfig {
  brand: string;
  name: string;
  logFormats: string[];
  icon: string; 
}

interface ProjectType {
  key: string;
  name: string;
  icon: string;
  description: string; 
}

interface ScriptInfo {
  name: string;
  path: string;
  size: number;
  type: 'Professional' | 'Creative' | 'Technical' | 'Workflow' | 'Automation';
  description: string; 
}

interface SmartScriptDownloaderProps {
  onDownload?: (scripts: ScriptInfo[]) => void;
  onPreview?: (script: ScriptInfo) => void;
  // Project context integration
  projectType?: string;
  culture?: string;
  currentPhase?: string;
  projectData?: any; 
}

const SmartScriptDownloader: React.FC<SmartScriptDownloaderProps> = ({ 
  onDownload, 
  onPreview,
  projectType: propProjectType,
  culture: propCulture,
  currentPhase: propCurrentPhase,
  projectData: propProjectData
}) => {
  const [activeStep, setActiveStep] = useState(false);
  
  // Theming system
  const theming = useTheming('videographer');
  const [selectedProjectType, setSelectedProjectType] = useState<string>(', ');
  const [selectedCameraBrand, setSelectedCameraBrand] = useState<string>(', ');
  const [selectedLogFormat, setSelectedLogFormat] = useState<string>(', ');
  const [selectedScriptTypes, setSelectedScriptTypes] = useState<string[]>(['Professional']);
  const [availableScripts, setAvailableScripts] = useState<ScriptInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Camera configurations
  const cameraConfigs: CameraConfig[] = [
    {
      brand: 'Sony',
      name: 'Sony Alpha Series',
      logFormats: ['S-Log','S-Log3'],
      icon: '📷',
    },
    {
      brand: 'Canon',
      name: 'Canon EOS Series',
      logFormats: ['C-Log','C-Log2','C-Log3'],
      icon: '📷',
    },
    {
      brand: 'Panasonic',
      name: 'Panasonic Lumix Series',
      logFormats: ['V-Log','V-LogL'],
      icon: '📷',
    },
    {
      brand: 'ARRI',
      name: 'ARRI Alexa Series',
      logFormats: ['ARRI LogC'],
      icon: '🎬',
    },
    {
      brand: 'Blackmagic',
      name: 'Blackmagic Design',
      logFormats: ['BMD Film'],
      icon: '🎬',
    },
    {
      brand: 'Fujifilm',
      name: 'Fujifilm X Series',
      logFormats: ['F-Log'],
      icon: '📷',
    },
    {
      brand: 'Nikon',
      name: 'Nikon Z Series',
      logFormats: ['N-Log'],
      icon: '📷',
    },
    {
      brand: 'RED',
      name: 'RED Digital Cinema',
      logFormats: ['RED LogFilm','RED IPP2'],
      icon: '🎬',
    },
    {
      brand: 'DJI',
      name: 'DJI Drones',
      logFormats: ['D-Log','D-LogM'],
      icon: '🚁',
    },
    {
      brand: 'Apple',
      name: 'Apple iPhone',
      logFormats: ['Apple Log'],
      icon: '📱',
    },
    {
      brand: 'Samsung',
      name: 'Samsung Galaxy',
      logFormats: ['Samsung Log'],
      icon: '📱',
    },
  ];

  // Project types
  const projectTypes: ProjectType[] = [
    { key: 'wedding', name: 'Wedding', icon: '💒', description: 'Wedding video production' },
    { key: 'commercial', name: 'Commercial', icon: '📺', description: 'Commercial and advertising' },
    { key: 'portrait', name: 'Portrait', icon: '🖼️', description: 'Portrait and photography' },
    { key: 'documentary', name: 'Documentary', icon: '🎬', description: 'Documentary production' },
    { key: 'sports', name: 'Sports', icon: '⚽', description: 'Sports and highlights' },
    { key: 'real-estate', name: 'Real Estate', icon: '🏠', description: 'Real estate video' },
    { key: 'tv-series', name: 'TV Series', icon: '📺', description: 'TV series and episodes' },
    { key: 'podcast', name: 'Podcast', icon: '🎙️', description: 'Podcast production' },
    { key: 'gaming', name: 'Gaming', icon: '🎮', description: 'Gaming content' },
    { key: 'film', name: 'Film', icon: '🎥', description: 'Film production' },
    { key: 'event', name: 'Event', icon: '🎉', description: 'Event and celebration' },
    { key: 'ai-integration', name: 'AI Integration', icon: '🤖', description: 'AI and automation' },
  ];

  // Script types
  const scriptTypes = [
    { key: 'Professional', name: 'Professional', description: 'Industry-standard color grading', color: 'primary' },
    { key: 'Creative', name: 'Creative', description: 'Artistic and stylized looks', color: 'secondary' },
    { key: 'Technical', name: 'Technical', description: 'Broadcast-safe and delivery-ready', color: 'success' },
    { key: 'Workflow', name: 'Workflow', description: 'Phase-specific color grading', color: 'info' },
    { key: 'Automation', name: 'Automation', description: 'AI-enhanced workflows', color: 'warning' },
  ];

  // Get selected camera config
  const selectedCamera = cameraConfigs.find(camera => camera.brand === selectedCameraBrand);

  // Auto-initialize from project context
  useEffect(() => {
    if (propProjectType) {
      setSelectedProjectType(propProjectType);
      setActiveStep(1); // Skip to camera selection
    }
  }, [propProjectType]);

  // Auto-detect camera brand from project data if available
  useEffect(() => {
    if (propProjectData?.cameraBrand) {
      setSelectedCameraBrand(propProjectData.cameraBrand);
      setActiveStep(2); // Skip to LOG format selection
    }
  }, [propProjectData?.cameraBrand]);

  // Auto-detect LOG format from project data if available
  useEffect(() => {
    if (propProjectData?.logFormat) {
      setSelectedLogFormat(propProjectData.logFormat);
      setActiveStep(3); // Skip to script type selection
    }
  }, [propProjectData?.logFormat]);

  // Auto-detect camera model from project data if available
  useEffect(() => {
    if (propProjectData?.primaryCamera) {
      // Extract brand from camera model (e.g., "Sony A7S III" -> "Sony")
      const cameraModel = propProjectData.primaryCamera;
      const brand = cameraModel.split(' , ')[0]; // Get first word as brand
      setSelectedCameraBrand(brand);

      // If LOG format is already detected, skip to script selection
      if (propProjectData.logFormat) {
        setActiveStep(3);
      } else {
        setActiveStep(2);
      }
    }
  }, [propProjectData?.primaryCamera]);

  // Auto-generate scripts for wedding projects with culture context
  useEffect(() => {
    if (propProjectType === 'wedding' && propCulture && !selectedCameraBrand && !selectedLogFormat) {
      // For wedding projects, show quick download options
      setActiveStep(4); // Skip to download step
      generateWeddingScripts();
    }
  }, [propProjectType, propCulture]);

  // Generate available scripts based on selections
  useEffect(() => {
    if (selectedProjectType && selectedCameraBrand && selectedLogFormat) {
      generateAvailableScripts();
    }
  }, [selectedProjectType, selectedCameraBrand, selectedLogFormat, selectedScriptTypes]);

  const generateAvailableScripts = () => {
    const scripts: ScriptInfo[] = [];

    selectedScriptTypes.forEach(scriptType => {
      const scriptName = `${selectedProjectType}-${selectedCameraBrand.toLowerCase()}-${selectedLogFormat.toLowerCase().replace('-', '_')}-${scriptType.toLowerCase()}-powergrade-creation.py`;
      const path = `${selectedProjectType}/${scriptName}`;

      scripts.push({
        name: scriptName,
        path: path,
        size: Math.floor(Math.random() * 20000) + 1500, // Simulated file size
        type: scriptType as any,
        description: `${scriptType} PowerGrade for ${selectedProjectType} with ${selectedCameraBrand} ${selectedLogFormat}`,
      });
    });

    setAvailableScripts(scripts);
  };

  const generateWeddingScripts = () => {
    const scripts: ScriptInfo[] = [];

    // Generate scripts for all major camera brands and LOG formats for wedding projects
    const weddingCameraConfigs = [
      { brand: 'Sony', logFormats: ['S-Log','S-Log3'] },
      { brand: 'Canon', logFormats: ['C-Log','C-Log3'] },
      { brand: 'Panasonic', logFormats: ['V-Log','V-LogL'] },
      { brand: 'ARRI', logFormats: ['LogC'] },
      { brand: 'Apple', logFormats: ['Apple Log'] },
      { brand: 'Samsung', logFormats: ['S-Log'] },
    ];

    const scriptTypes = ['Professional','Creative','Workflow'];

    weddingCameraConfigs.forEach(camera => {
      camera.logFormats.forEach(logFormat => {
        scriptTypes.forEach(scriptType => {
          const scriptName = `wedding-${camera.brand.toLowerCase()}-${logFormat.toLowerCase().replace('-','_')}-${scriptType.toLowerCase()}-powergrade-creation.py`;
          const path = `wedding/${scriptName}`;

          scripts.push({
            name: scriptName,
            path: path,
            size: Math.floor(Math.random() * 20000) + 1500,
            type: scriptType as any,
            description: `${scriptType} PowerGrade for ${propCulture} wedding with ${camera.brand} ${logFormat}`,
          });
        });
      });
    });

    setAvailableScripts(scripts);
  };

  const handleDownloadScripts = async () => {
    if (availableScripts.length === 0) return;

    setLoading(true);
    setDownloadProgress(0);

    try {
      // Simulate download progress
      for (let i = 0; i <= 100; i += 10) {
        setDownloadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Call parent callback
      if (onDownload) {
        onDownload(availableScripts);
      }

      setLoading(false);
    } catch (error) {
      console.error('Download failed: ', error);
      setLoading(false);
    }
  };

  const handlePreviewScript = (script: ScriptInfo) => {
    if (onPreview) {
      onPreview(script);
    }
  };

  const getTotalFileSize = () => {
    return availableScripts.reduce((total, script) => total + script.size, 0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ', ' + sizes[i];
  };

  const steps = [
    'Choose Project Type','Select Camera Brand','Choose LOG Format','Select Script Types','Download Scripts',
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        🎬 Smart PowerGrade Script Downloader
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Get exactly the PowerGrade scripts you need for your specific camera and project type.
      </Typography>

      {/* Project Context Display */}
      {propProjectType && (
        <Paper sx={{ ...theming.getThemedCardSx(), p: 2, mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            🎯 Project Context Detected
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip
              label={`Project: ${projectTypes.find(p => p.key === propProjectType)?.name}`}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: 'primary.main' }}
            />
            {propCulture && (
              <Chip
                label={`Culture: ${propCulture}`}
                sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: 'primary.main' }}
              />
            )}
            {propCurrentPhase && (
              <Chip
                label={`Phase: ${propCurrentPhase}`}
                sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: 'primary.main' }}
              />
            )}
          </Box>
          {propProjectType === 'wedding' && propCulture && (
            <Box>
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.9, mb: 2 }}>
                🎉 Perfect! We'll automatically filter scripts for {propCulture} wedding traditions and cultural aesthetics.
              </Typography>

              {/* Quick Download Section for Wedding Projects */}
              <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  🚀 Quick Download for {propCulture} Wedding
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, opacity: 0.9 }}>
                  Download all PowerGrade scripts for {propCulture} wedding projects across all major camera brands and LOG formats.
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => {
                    generateWeddingScripts();
                    setActiveStep(4);
                  }}
                  sx={{
                    ...theming.getThemedButtonSx(),
                    bgcolor: 'rgba(255,255,255,0.04)',
                    color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' }}}
                >
                  Download All Wedding Scripts
                </Button>
              </Box>
            </Box>
          )}
        </Paper>
      )}

      {/* Progress Stepper */}
      <Paper sx={{ ...theming.getThemedCardSx(), p: 2, mb: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Step 1: Project Type Selection */}
      <Paper sx={{ ...theming.getThemedCardSx(), p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          📋 Step 1: Choose Your Project Type
        </Typography>
        <Grid container spacing={2}>
          {projectTypes.map((project) => (
            <Grid item xs={12} sm={6} md={4} key={project.key}>
              <Card
                sx={{
                  ...theming.getThemedCardSx(),
                  cursor: 'pointer',
                  border: selectedProjectType === project.key ? 2 : 1,
                  borderColor: selectedProjectType === project.key ? 'primary.main' : 'divider',
                  bgcolor: selectedProjectType === project.key ? 'primary.light' : 'background.paper'}}
                onClick={() => {
                  setSelectedProjectType(project.key);
                  setActiveStep(1);
                }}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    {project.icon} {project.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {project.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Step 2: Camera Brand Selection */}
      {selectedProjectType && (
        <Paper sx={{ ...theming.getThemedCardSx(), p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            📷 Step 2: Select Your Camera Brand
          </Typography>
          <Grid container spacing={2}>
            {cameraConfigs.map((camera) => (
              <Grid item xs={12} sm={6} md={4} key={camera.brand}>
                <Card
                  sx={{
                    ...theming.getThemedCardSx(),
                    cursor: 'pointer',
                    border: selectedCameraBrand === camera.brand ? 2 : 1,
                    borderColor: selectedCameraBrand === camera.brand ? 'primary.main' : 'divider',
                    bgcolor: selectedCameraBrand === camera.brand ? 'primary.light' : 'background.paper'}}
                  onClick={() => {
                    setSelectedCameraBrand(camera.brand);
                    setSelectedLogFormat(''); // Reset LOG format
                    setActiveStep(2);
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      {camera.icon} {camera.brand}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {camera.name}
                    </Typography>
                    <Typography variant="caption" display="block">
                      {camera.logFormats.length} LOG formats available
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Step 3: LOG Format Selection */}
      {selectedCameraBrand && selectedCamera && (
        <Paper sx={{ ...theming.getThemedCardSx(), p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            🎬 Step 3: Choose Your LOG Format
          </Typography>
          <Grid container spacing={2}>
            {selectedCamera.logFormats.map((logFormat) => (
              <Grid item xs={12} sm={6} md={4} key={logFormat}>
                <Card
                  sx={{
                    ...theming.getThemedCardSx(),
                    cursor: 'pointer',
                    border: selectedLogFormat === logFormat ? 2 : 1,
                    borderColor: selectedLogFormat === logFormat ? 'primary.main' : 'divider',
                    bgcolor: selectedLogFormat === logFormat ? 'primary.light' : 'background.paper'}}
                  onClick={() => {
                    setSelectedLogFormat(logFormat);
                    setActiveStep(3);
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      {selectedCamera.icon} {logFormat}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedCamera.brand} {logFormat} LOG format
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Step 4: Script Type Selection */}
      {selectedLogFormat && (
        <Paper sx={{ ...theming.getThemedCardSx(), p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            🎨 Step 4: Select Script Types
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose which types of PowerGrade scripts you want to download:
          </Typography>
          <FormGroup>
            <Grid container spacing={2}>
              {scriptTypes.map((scriptType) => (
                <Grid item xs={12} sm={6} md={4} key={scriptType.key}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedScriptTypes.includes(scriptType.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedScriptTypes([...selectedScriptTypes, scriptType.key]);
                          } else {
                            setSelectedScriptTypes(selectedScriptTypes.filter(type => type !== scriptType.key));
                          }
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="subtitle2">
                          {scriptType.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {scriptType.description}
                        </Typography>
                      </Box>
                    }
                  />
                </Grid>
              ))}
            </Grid>
          </FormGroup>
        </Paper>
      )}

      {/* Step 5: Download Scripts */}
      {availableScripts.length > 0 && (
        <Paper sx={{ ...theming.getThemedCardSx(), p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            📥 Step 5: Download Your Scripts
          </Typography>

          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Perfect Match Found!</strong> We found {availableScripts.length} PowerGrade scripts for your {selectedProjectType} project with {selectedCameraBrand} {selectedLogFormat}.
            </Typography>
          </Alert>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Scripts to Download:
            </Typography>
            <List dense>
              {availableScripts.map((script) => (
                <ListItem key={script.name}>
                  <ListItemIcon>
                    <Code />
                  </ListItemIcon>
                  <ListItemText
                    primary={script.name}
                    secondary={`${formatFileSize(script.size)} • ${script.type}`}
                  />
                  <ListItemIcon>
                    <IconButton
                      size="small"
                      onClick={() => handlePreviewScript(script)}
                    >
                      {theming.getThemedIcon('info')}
                    </IconButton>
                  </ListItemIcon>
                </ListItem>
              ))}
            </List>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Total Size: {formatFileSize(getTotalFileSize())}
            </Typography>
            <Badge badgeContent={availableScripts.length} color="primary">
              <Typography variant="body2">
                {availableScripts.length} Scripts
              </Typography>
            </Badge>
          </Box>

          <Button
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : theming.getThemedIcon('download')}
            onClick={handleDownloadScripts}
            disabled={loading || availableScripts.length === 0}
            fullWidth
            sx={theming.getThemedButtonSx()}
          >
            {loading ? `Downloading... ${downloadProgress}%` : `Download ${availableScripts.length} Scripts`}
          </Button>
        </Paper>
      )}

      {/* Summary */}
      {selectedProjectType && selectedCameraBrand && selectedLogFormat && (
        <Paper sx={{ ...theming.getThemedCardSx(), p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            🎯 Your Selection Summary
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip
              label={`Project: ${projectTypes.find(p => p.key === selectedProjectType)?.name}`}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: 'primary.main' }}
            />
            <Chip
              label={`Camera: ${selectedCameraBrand}`}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: 'primary.main' }}
            />
            <Chip
              label={`LOG: ${selectedLogFormat}`}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: 'primary.main' }}
            />
            <Chip
              label={`Types: ${selectedScriptTypes.join(', ')}`}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)', color:'primary.main' }}
            />
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default SmartScriptDownloader;
