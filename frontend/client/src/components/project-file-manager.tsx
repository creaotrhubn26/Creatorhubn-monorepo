import { useTheming } from '../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Tabs,
  Tab,
  Paper,
  Chip,
  Stack,
  IconButton,
  LinearProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Avatar
} from '@mui/material';
import {
  Folder,
  CloudDone,
  Share,
  Download,
  PhotoLibrary,
  Videocam,
  FileDownload,
  Schedule,
  CheckCircle,
  PlayArrow,
  ExpandMore,
  AutoAwesome,
  Movie,
  Star,
  Collections,
  Assessment,
  Send,
  EditNote
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface ProjectFileManagerProps {
  projectId: string;
  profession: 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
  userId: string
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

export default function ProjectFileManager({ projectId, profession, userId }: ProjectFileManagerProps) {
  const [tabValue, setTabValue] = useState(0);
  const [showPhotoCulling, setShowPhotoCulling] = useState(false);
  const [showEnhancement, setShowEnhancement] = useState(false);
  const [showStoryArc, setShowStoryArc] = useState(false);
  const [showShowcase, setShowShowcase] = useState(false);
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer, ');

  // Fetch project data
  const { data: project, isLoading } = useQuery({
    queryKey: [`/api/projects/${projectId}`],
    retry: false,
    queryFn: () => apiRequest(`/api/projects/${projectId}`),
});

  // Fetch project files
  const { data: projectFiles = [, ],} = useQuery({
    queryKey: [`/api/projects/${projectId}/files`],
    retry: false,
    queryFn: () => apiRequest(`/api/projects/${projectId}/files`),
});

  // Post-production workflow steps
  const photoWorkflowSteps = [
    'Import Raw Files','Photo Culling','Enhancement & Editing''Client Gallery Creation','Universal Showcase','Final Delivery'
  ];

  const videoWorkflowSteps = [
    'Import Raw Footage','StoryArc Studio Editing', 'Color Grading & Effects', 'Client Preview', 'Universal Showcase', 'Final Export & Delivery'
  ];

  const currentWorkflowSteps = profession === 'photographer' ? photoWorkflowSteps : videoWorkflowSteps;

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
};

  const getFileTypeIcon = (fileType: string) => {
    if (fileType.includes('image,')) return <PhotoLibrary sx={{ color: '#2e7d32'}} />;
    if (fileType.includes('video')) return <Videocam sx={{ color: '#1565c0'}} />;
    return <Folder sx={{ color: '#757575'}} />;
};

  const getProfessionColor = () => {
    switch (profession) {
      case 'photographer': return '#2e7d32';
      case 'videographer': return '#1565c0';
      case 'musicproducer': return '#7b1fa2';
      default: return '#757575';
}
};

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Box sx={{ mb:  3 }}>
        <Typography variant="h4" sx={{  color: getProfessionColor(), fontWeight: 600, mb:  1  }}>
          Post-Produksjon - {project?.name || 'Prosjekt'}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Phase 3: Seamless editing og delivery workflow
        </Typography>
      </Box>

      {/* Workflow Progress , *, /}
      <Card sx={{ mb:  3, border: `1px solid ${getProfessionColor()}30` ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" sx={{  mb: 2, color: getProfessionColor() }}>
            Workflow Status
          </Typography>
          <Stepper activeStep={2} alternativeLabel>
            {currentWorkflowSteps.map((label, index) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        {profession === 'photographer' && (
          <>
            <Grid size={{ xs: 12 }} md={3}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { transform: 'translateY(-2px)', transition: 'all 0.3s ease',}
              }}
                onClick={() => setShowPhotoCulling(true)}
              >
                <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                  <PhotoLibrary sx={{ fontSize:  48, color: getProfessionColor(), mb:  1 }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Photo Culling</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Seamless foto sortering
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12 }} md={3}>
              <Card 
                sx={{ 
                  cursor: 'pointer','&:hover': { transform: 'translateY(-2px)', transition: 'all 0.3s ease',}
              }}
                onClick={() => setShowEnhancement(true)}
              >
                <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                  <AutoAwesome sx={{ fontSize:  48, color: getProfessionColor(), mb:  1 }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Enhancement</Typography>
                  <Typography variant="body2" color="text.secondary">
                    AI-powered editing
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
        
        {profession === 'videographer' && (
          <Grid size={{ xs: 12 }} md={3}>
            <Card 
              sx={{ 
                cursor: 'pointer','&:hover': { transform: 'translateY(-2px)', transition: 'all 0.3s ease',}
            }}
              onClick={() => setShowStoryArc(true)}
            >
              <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <Movie sx={{ fontSize:  48, color: getProfessionColor(), mb:  1 }} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>StoryArc Studio</Typography>
                <Typography variant="body2" color="text.secondary">
                  Professional video editing
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        <Grid size={{ xs: 12 }} md={3}>
          <Card 
            sx={{ 
              cursor: 'pointer', '&:hover': { transform: 'translateY(-2px)', transition: 'all 0.3s ease',}
          }}
            onClick={() => setShowShowcase(true)}
          >
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Star sx={{ fontSize:  48, color: getProfessionColor(), mb:  1 }} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Universal Showcase</Typography>
              <Typography variant="body2" color="text.secondary">
                Professional delivery
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }} md={3}>
          <Card sx={{ cursor: 'pointer',  ...theming.getThemedCardSx() }}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Collections sx={{ fontSize:  48, color: getProfessionColor(), mb:  1 }} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Client Gallery</Typography>
              <Typography variant="body2" color="text.secondary">
                Client accessible gallery
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ width: '100%',  ...theming.getThemedCardSx() }}>
        <Tabs 
          value={tabValue}
          onChange={handleTabChange}
          sx={{ borderBottom: 1, borderColor: 'divider'}}
        >
          <Tab label="File Overview" />
          <Tab label="Processing Queue" />
          <Tab label="Delivery Status" />
          <Tab label="Client Access" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" sx={{  mb:  2  }}>
            Project Files
          </Typography>
          <Grid container spacing={2}>
            {projectFiles.map((file: any, index: number) => (
              <Grid size={{ xs: 12 }} md={6} lg={4} key={index}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                      {getFileTypeIcon(file.type)}
                      <Box sx={{ flex:  1 }}>
                        <Typography variant="body1">{file.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {file.size} • {file.type}
                        </Typography>
                      </Box>
                      <IconButton size="small">
                        {theming.getThemedIcon('download')}
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" sx={{  mb:  2  }}>
            Processing Queue
          </Typography>
          <Alert severity="info" sx={{ mb:  2 }}>
            Files are processed automatically through the {profession === 'photographer' ? 'photo editing' : 'video editing'} pipeline.
          </Alert>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" sx={{  mb:  2  }}>
            Delivery Status
          </Typography>
          <Stack spacing={2}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                  <CheckCircle sx={{ color: 'success.main'}} />
                  <Box sx={{ flex:  1 }}>
                    <Typography variant="body1">Universal Showcase</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ready for client viewing
                    </Typography>
                  </Box>
                  <Button variant="outlined" size="small">
                    View
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" sx={{  mb:  2  }}>
            Client Access
          </Typography>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="body1" sx={{ mb:  2 }}>
                Client Gallery Link
              </Typography>
              <Box sx={{ display: 'flex', gap:  2 }}>
                <Button variant="contained" startIcon={theming.getThemedIcon('share')} sx={theming.getThemedButtonSx()}>
                  Share Gallery
                </Button>
                <Button variant="outlined" startIcon={<Send />}>
                  Send Email
                </Button>
              </Box>
            </CardContent>
          </Card>
        </TabPanel>
      </Paper>

      {/* Integration Dialogs - Connected to SmartWorkflowSystem */}
      <Typography variant="body2" color="text.secondary" sx={{ mt:  3, textAlign: 'center'}}>
        🎯 Integrated med SmartWorkflowSystem.tsx for seamless post-production workflow
      </Typography>
    </Box>
  );
}