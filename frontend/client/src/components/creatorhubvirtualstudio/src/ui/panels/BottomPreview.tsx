import * as React from 'react';
import {
  Box,
  Paper,
  Stack,
  Typography,
  Button,
  Tabs,
  Tab,
  TextField,
  IconButton,
} from '@mui/material';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import SaveAltOutlinedIcon from '@mui/icons-material/SaveAltOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
import CameraIcon from '@mui/icons-material/Camera';
import Stage3D from '@/ui/stage3d/Stage3D';
import { useScene, useNodes } from '@/state/selectors';
import { exportJSON } from '@/core/services/exporter';
import { saveLocal } from '@/core/services/serializer';
import ExportDialog from '@/ui/dialogs/ExportDialog';

export default function BottomPreview() {
  const scene = useScene();
  const nodes = useNodes();
  const id = scene.selection[0];
  const selected = scene.nodes.find((n) => n.id === id);
  const [open, setOpen] = React.useState(false);
  const [bottomTab, setBottomTab] = React.useState(0);
  
  // Find camera node
  const cameraNode = nodes.find((n) => n.type === 'camera');
  const cameraSettings = cameraNode?.camera || { focalLength: 50, aperture: 2.8, iso: 100, shutter: 1/125 };
  
  return (
    <Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#1a1a1a' }}>
      {/* Top row: Lens controls, Camera selection, Export buttons */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ px: 2, py: 1, borderBottom: '1px solid #2a2a2a' }}>
        {/* Lens/Focal Length Controls (Left) */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color="#888888" fontSize={11}>
            {cameraSettings.focalLength}mm
          </Typography>
          <IconButton 
            size="small" 
            sx={{ 
              color: '#ffffff', 
              transition: 'all 0.2s ease',
              '&:hover': { 
                bgcolor: '#2a2a2a',
                transform: 'scale(1.1)'
              },
              '&:active': {
                transform: 'scale(0.95)'
              }
            }}
          >
            <Typography sx={{ fontSize: 12 }}>−</Typography>
          </IconButton>
          <IconButton 
            size="small" 
            sx={{ 
              color: '#ffffff', 
              transition: 'all 0.2s ease',
              '&:hover': { 
                bgcolor: '#2a2a2a',
                transform: 'scale(1.1)'
              },
              '&:active': {
                transform: 'scale(0.95)'
              }
            }}
          >
            <Typography sx={{ fontSize: 12 }}>+</Typography>
          </IconButton>
        </Stack>
        
        {/* Camera/Lens Selection (Center) */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, justifyContent: 'center' }}>
          <Button
            size="small"
            variant="contained"
            sx={{
              minWidth: 40,
              bgcolor: '#ffffff',
              color: '#1a1a1a',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              '&:hover': { 
                bgcolor: '#f0f0f0',
                transform: 'translateY(-2px) scale(1.05)',
                boxShadow: '0 4px 12px rgba(255,255,255,0.3)'
              },
              '&:active': {
                transform: 'translateY(0) scale(0.95)',
                boxShadow: '0 2px 6px rgba(255,255,255,0.2)'
              }
            }}
          >
            36
          </Button>
          <Button
            size="small"
            variant="outlined"
            sx={{
              minWidth: 60,
              borderColor: '#3a3a3a',
              color: '#ffffff',
              transition: 'all 0.2s ease',
              '&:hover': { 
                borderColor: '#5a5a5a', 
                bgcolor: '#2a2a2a',
                transform: 'translateY(-1px)'
              },
              '&:active': {
                transform: 'translateY(0)'
              }
            }}
          >
            45 mm
          </Button>
          <Button
            size="small"
            variant="outlined"
            sx={{
              minWidth: 60,
              borderColor: '#3a3a3a',
              color: '#ffffff',
              transition: 'all 0.2s ease',
              '&:hover': { 
                borderColor: '#5a5a5a', 
                bgcolor: '#2a2a2a',
                transform: 'translateY(-1px)'
              },
              '&:active': {
                transform: 'translateY(0)'
              }
            }}
          >
            55 mm
          </Button>
          <Button
            size="small"
            variant="outlined"
            sx={{
              minWidth: 60,
              borderColor: '#3a3a3a',
              color: '#ffffff',
              transition: 'all 0.2s ease',
              '&:hover': { 
                borderColor: '#5a5a5a', 
                bgcolor: '#2a2a2a',
                transform: 'translateY(-1px)'
              },
              '&:active': {
                transform: 'translateY(0)'
              }
            }}
          >
            50 mm
          </Button>
          <Button
            size="small"
            variant="outlined"
            sx={{
              minWidth: 60,
              borderColor: '#3a3a3a',
              color: '#ffffff',
              transition: 'all 0.2s ease',
              '&:hover': { 
                borderColor: '#5a5a5a', 
                bgcolor: '#2a2a2a',
                transform: 'translateY(-1px)'
              },
              '&:active': {
                transform: 'translateY(0)'
              }
            }}
          >
            Cam 6
          </Button>
        </Stack>
        
        {/* Camera Settings Display */}
        <Typography variant="caption" color="#888888" fontSize={11} sx={{ mr: 1 }}>
          {cameraSettings.aperture} N {cameraSettings.iso} ISO {cameraSettings.shutter < 1 ? `1/${Math.round(1/cameraSettings.shutter)}` : cameraSettings.shutter}s - {((cameraSettings.aperture * cameraSettings.aperture) / (cameraSettings.iso * cameraSettings.shutter)).toFixed(1)} EV
        </Typography>
        
        {/* Export Buttons (Right) */}
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CameraIcon fontSize="small" />}
            sx={{
              textTransform: 'none',
              borderColor: '#3a3a3a',
              color: '#ffffff',
              transition: 'all 0.2s ease',
              '&:hover': { 
                borderColor: '#5a5a5a', 
                bgcolor: '#2a2a2a',
                transform: 'translateY(-1px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              },
              '&:active': {
                transform: 'translateY(0)'
              }
            }}
          >
            Snapshot
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PictureAsPdfOutlinedIcon fontSize="small" />}
            onClick={() => setOpen(true)}
            sx={{
              textTransform: 'none',
              borderColor: '#3a3a3a',
              color: '#ffffff',
              transition: 'all 0.2s ease',
              '&:hover': { 
                borderColor: '#5a5a5a', 
                bgcolor: '#2a2a2a',
                transform: 'translateY(-1px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              },
              '&:active': {
                transform: 'translateY(0)'
              }
            }}
          >
            Export PDF
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ImageOutlinedIcon fontSize="small" />}
            onClick={() => setOpen(true)}
            sx={{
              textTransform: 'none',
              borderColor: '#3a3a3a',
              color: '#ffffff',
              transition: 'all 0.2s ease',
              '&:hover': { 
                borderColor: '#5a5a5a', 
                bgcolor: '#2a2a2a',
                transform: 'translateY(-1px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              },
              '&:active': {
                transform: 'translateY(0)'
              }
            }}
          >
            PNG
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CompareArrowsOutlinedIcon fontSize="small" />}
            sx={{
              textTransform: 'none',
              borderColor: '#3a3a3a',
              color: '#ffffff',
              transition: 'all 0.2s ease',
              '&:hover': { 
                borderColor: '#5a5a5a', 
                bgcolor: '#2a2a2a',
                transform: 'translateY(-1px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              },
              '&:active': {
                transform: 'translateY(0)'
              }
            }}
          >
            Compare AB
          </Button>
        </Stack>
      </Stack>
      
      {/* Bottom: Notes/Assets Tabs */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Tabs 
          value={bottomTab} 
          onChange={(_, v) => setBottomTab(v)}
          sx={{
            borderBottom: '1px solid #2a2a2a',
            '& .MuiTab-root': {
              color: '#888888',
              textTransform: 'none',
              fontSize: 12,
              fontWeight: 600,
              minHeight: 40,
              '&.Mui-selected': {
                color: '#ffffff',
              },
            },
            '& .MuiTabs-indicator': {
              bgcolor: '#ffffff',
            },
          }}
        >
          <Tab label="Notes" />
          <Tab label="Assets" />
        </Tabs>
        
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {bottomTab === 0 && (
            <Typography color="#888888" fontSize={13}>
              Add notes about this scene setup...
            </Typography>
          )}
          {bottomTab === 1 && (
            <Typography color="#888888" fontSize={13}>
              Scene assets and resources...
            </Typography>
          )}
        </Box>
      </Box>
      
      <ExportDialog open={open} onClose={() => setOpen(false)} />
    </Box>
  );
}
