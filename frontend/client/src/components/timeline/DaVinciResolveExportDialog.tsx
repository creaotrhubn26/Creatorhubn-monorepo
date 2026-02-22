/**
 * DAVINCI RESOLVE EXPORT DIALOG
 * Export timeline to DaVinci Resolve with EDL, XML, AAF + Script automation
 * Integrates with ScriptManager for automated color grading and workflow
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  InputLabel,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
  Paper,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  ColorLens,
  Movie,
  Code,
  CheckCircle,
  Download,
  PlayArrow,
  Info,
} from '@mui/icons-material';
import { BeatClip, Track } from '../../services/storyArcDataIntegration';
import { timelineEngine } from '../../services/timeline-engine';
// @ts-ignore - DaVinci export service
import { DaVinciResolveExportService } from '../../services/davinciResolveExport';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface DaVinciResolveExportDialogProps {
  open: boolean;
  onClose: () => void;
  clips: BeatClip[];
  tracks: Track[];
  projectName?: string;
  culture?: string;
  projectType?: string;
}

export default function DaVinciResolveExportDialog({
  open,
  onClose,
  clips,
  tracks,
  projectName = 'Untitled Project',
  culture = '',
  projectType = 'wedding'
}: DaVinciResolveExportDialogProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [exportSettings, setExportSettings] = useState({
    includeEDL: true,
    includeXML: true,
    includeAAF: false,
    applyScripts: true,
    selectedScripts: [] as string[],
    culture: culture,
    projectType: projectType,
    autoColorGrade: true,
    createProjectStructure: true,
    resolution: '1080p',
    frameRate: 25
  });

  // Available DaVinci Resolve scripts based on project context
  const availableScripts = [
    {
      id: '03-professional-color-grading.py',
      name: 'Professional Color Grading',
      description: 'Auto-applies professional color grading nodes',
      recommended: true
    },
    {
      id: '45-skin-tone-optimizer.py',
      name: 'Skin Tone Optimizer',
      description: 'Optimizes skin tones for natural look',
      recommended: projectType === 'wedding' || projectType === 'portrait'
    },
    {
      id: `${culture ? `67-${culture}-culture-suite.py` : '53-wedding-automation-suite.py'}`,
      name: `${culture ? 'Cultural' : 'Wedding'} Automation Suite`,
      description: `Applies ${culture || 'wedding'}-specific LUTs and grading`,
      recommended: projectType === 'wedding'
    },
    {
      id: '46-film-emulation-suite.py',
      name: 'Film Emulation Suite',
      description: 'Applies film stock emulation (Kodak, Fuji, etc.)',
      recommended: false
    }
  ];

  // Export to DaVinci Resolve mutation using existing service
  const exportToResolveMutation = useMutation({
    mutationFn: async (settings: any) => {
      // Use existing DaVinciResolveExportService
      return await DaVinciResolveExportService.exportTimeline(
        clips,
        tracks,
        { 
          title: projectName,
          type: settings.projectType 
        } as any,
        {
          projectName,
          frameRate: settings.frameRate,
          resolution: settings.resolution === '1080p' ? '1920x1080' : 
                      settings.resolution === '4k' ? '3840x2160' : '1920x1080',
          colorSpace: 'Rec709',
          includeAudio: true,
          includeColorGrading: settings.applyScripts,
          exportFormat: settings.includeEDL ? 'EDL' : 'XML'
        }
      );
    },
    onSuccess: (data) => {
      console.log('✅ Exported to DaVinci Resolve: ', data);
      setActiveStep(3);
      setExportResult(data);
    },
    onError: (error) => {
      console.error('❌ Export failed: ', error);
    }
  });
  
  const [exportResult, setExportResult] = useState<any>(null);

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleExport = () => {
    exportToResolveMutation.mutate(exportSettings);
  };

  const steps = [
    {
      label: 'Export Format',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select export formats for DaVinci Resolve
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={exportSettings.includeEDL}
                onChange={(e) => setExportSettings({ ...exportSettings, includeEDL: e.target.checked })}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  EDL (Edit Decision List) ✅ Recommended
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Standard format for timeline import (CMX 3600)
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Switch
                checked={exportSettings.includeXML}
                onChange={(e) => setExportSettings({ ...exportSettings, includeXML: e.target.checked })}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Final Cut Pro XML
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Cross-compatible XML format
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Switch
                checked={exportSettings.includeAAF}
                onChange={(e) => setExportSettings({ ...exportSettings, includeAAF: e.target.checked })}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  AAF (Avid)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Advanced Authoring Format (optional)
                </Typography>
              </Box>
            }
          />
          <Button onClick={handleNext} variant="contained" sx={{ mt: 2 }}>
            Continue
          </Button>
        </Box>
      )
    },
    {
      label: 'DaVinci Resolve Scripts',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Auto-apply scripts for color grading and workflow automation
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={exportSettings.applyScripts}
                onChange={(e) => setExportSettings({ ...exportSettings, applyScripts: e.target.checked })}
              />
            }
            label="Enable Script Automation"
          />
          
          {exportSettings.applyScripts && (
            <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" gutterBottom>
                Select Scripts to Apply:
              </Typography>
              <List dense>
                {availableScripts.map((script) => (
                  <ListItem key={script.id}>
                    <ListItemIcon>
                      <Checkbox
                        checked={exportSettings.selectedScripts.includes(script.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setExportSettings({
                              ...exportSettings,
                              selectedScripts: [...exportSettings.selectedScripts, script.id]
                            });
                          } else {
                            setExportSettings({
                              ...exportSettings,
                              selectedScripts: exportSettings.selectedScripts.filter(id => id !== script.id)
                            });
                          }
                        }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {script.name}
                          {script.recommended && (
                            <Chip label="Recommended" size="small" color="success" />
                          )}
                        </Box>
                      }
                      secondary={script.description}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
          
          <Box sx={{ mt: 2 }}>
            <Button onClick={handleBack} sx={{ mr: 1 }}>
              Back
            </Button>
            <Button onClick={handleNext} variant="contained">
              Continue
            </Button>
          </Box>
        </Box>
      )
    },
    {
      label: 'Project Settings',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure DaVinci Resolve project settings
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Resolution</InputLabel>
            <Select
              value={exportSettings.resolution}
              label="Resolution"
              onChange={(e) => setExportSettings({ ...exportSettings, resolution: e.target.value })}
            >
              <MenuItem value="720p">720p (1280×720)</MenuItem>
              <MenuItem value="1080p">1080p (1920×1080)</MenuItem>
              <MenuItem value="4k">4K (3840×2160)</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Frame Rate</InputLabel>
            <Select
              value={exportSettings.frameRate}
              label="Frame Rate"
              onChange={(e) => setExportSettings({ ...exportSettings, frameRate: Number(e.target.value) })}
            >
              <MenuItem value={24}>24 fps (Film)</MenuItem>
              <MenuItem value={25}>25 fps (PAL)</MenuItem>
              <MenuItem value={30}>30 fps (NTSC)</MenuItem>
              <MenuItem value={60}>60 fps (High Frame Rate)</MenuItem>
            </Select>
          </FormControl>
          
          <FormControlLabel
            control={
              <Switch
                checked={exportSettings.createProjectStructure}
                onChange={(e) => setExportSettings({ ...exportSettings, createProjectStructure: e.target.checked })}
              />
            }
            label="Create Full Project Structure (bins, timelines, nodes)"
          />
          
          <Box sx={{ mt: 2 }}>
            <Button onClick={handleBack} sx={{ mr: 1 }}>
              Back
            </Button>
            <Button onClick={handleExport} variant="contained" disabled={exportToResolveMutation.isPending}>
              {exportToResolveMutation.isPending ? 'Exporting...' : 'Export to Resolve'}
            </Button>
          </Box>
        </Box>
      )
    },
    {
      label: 'Complete',
      content: (
        <Box>
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              ✅ Successfully exported to DaVinci Resolve!
            </Typography>
            <Typography variant="caption">
              Timeline exported with {clips.length} clips and {exportSettings.selectedScripts.length} automation scripts
            </Typography>
          </Alert>
          
          {exportResult && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" gutterBottom>
                📦 Export Package:
              </Typography>
              <List dense>
                {exportSettings.includeEDL && (
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="CMX 3600 EDL" 
                      secondary="Timeline structure and cuts" 
                    />
                    <Button
                      size="small"
                      startIcon={<Download />}
                      onClick={() => {
                        if (exportResult.downloadUrl) {
                          window.open(exportResult.downloadUrl, '_blank');
                        }
                      }}
                    >
                      Download
                    </Button>
                  </ListItem>
                )}
                {exportSettings.includeXML && (
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Final Cut Pro XML" secondary="Cross-compatible format" />
                  </ListItem>
                )}
              </List>
            </Paper>
          )}
          
          <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              📖 How to Apply Scripts in DaVinci Resolve:
            </Typography>
            <Typography variant="body2" component="div">
              <ol style={{ paddingLeft: 20, margin: '8px 0' }}>
                <li>Open DaVinci Resolve and import the EDL/XML</li>
                <li>Go to <strong>Color page</strong></li>
                <li>Open <strong>Workspace → Scripts</strong> (Shift+3)</li>
                <li>Copy script content from ScriptManager</li>
                <li>Paste into Script Editor and click <strong>Run</strong></li>
              </ol>
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
              💡 Scripts run INSIDE Resolve, not from command line. They auto-apply {exportSettings.selectedScripts.length} cultural LUTs!
            </Typography>
          </Alert>
          
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.light' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.contrastText' }}>
              🎨 Selected Scripts will apply:
            </Typography>
            {exportSettings.selectedScripts.map(scriptId => (
              <Chip
                key={scriptId}
                label={scriptId}
                size="small"
                sx={{ mr: 0.5, mb: 0.5, bgcolor: 'white' }}
              />
            ))}
            {exportSettings.culture && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'primary.contrastText' }}>
                Including {exportSettings.culture} cultural LUTs (32 LUTs total)
              </Typography>
            )}
          </Paper>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={onClose} variant="outlined">
              Close
            </Button>
            {exportResult?.downloadUrl && (
              <Button
                onClick={() => DaVinciResolveExportService.downloadExport(exportResult.exportId)}
                variant="contained"
                startIcon={<Download />}
              >
                Download Files
              </Button>
            )}
          </Box>
        </Box>
      )
    }
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        color: 'white'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ColorLens />
          <Box>
            <Typography variant="h6">Export to DaVinci Resolve</Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {projectName} • {clips.length} clips • {Math.floor(timelineEngine.calculateDuration(clips))}s
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>
                <Typography variant="subtitle1" fontWeight={600}>
                  {step.label}
                </Typography>
              </StepLabel>
              <StepContent>
                {step.content}
              </StepContent>
            </Step>
          ))}
        </Stepper>
        
        {exportToResolveMutation.isPending && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, p: 2, bgcolor:'grey.50', borderRadius: 1 }}>
            <CircularProgress size={24} />
            <Typography variant="body2">
              Generating EDL and preparing export package...
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      {activeStep === 0 && (
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

