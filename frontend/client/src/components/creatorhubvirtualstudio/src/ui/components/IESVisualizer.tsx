/**
 * IES Visualizer Component
 * 
 * Visualizes IES profile distribution in 3D viewport
 */

import React, { useMemo } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import * as THREE from 'three';
import { IESProfile, renderIESToCanvas } from '../../core/services/ies';

interface IESVisualizerProps {
  profile: IESProfile;
  size?: number;
  show3D?: boolean;
}

export const IESVisualizer: React.FC<IESVisualizerProps> = ({
  profile,
  size = 256,
  show3D = false,
}) => {
  const canvas = useMemo(() => {
    return renderIESToCanvas(profile, size);
  }, [profile, size]);
  
  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'rgba(26, 26, 26, 0.95)',
        color: '#ffffff',
      }}
    >
      <Typography variant="h6" sx={{ mb: 2, color: '#ffffff' }}>
        IES Profile Visualization
      </Typography>
      
      {profile.metadata && (
        <Box sx={{ mb: 2 }}>
          {profile.metadata.manufacturer && (
            <Typography variant="body2" sx={{ color: '#aaaaaa' }}>
              Manufacturer: {profile.metadata.manufacturer}
            </Typography>
          )}
          {profile.metadata.luminaire && (
            <Typography variant="body2" sx={{ color: '#aaaaaa' }}>
              Luminaire: {profile.metadata.luminaire}
            </Typography>
          )}
          {profile.metadata.lumens && (
            <Typography variant="body2" sx={{ color: '#aaaaaa' }}>
              Lumens: {profile.metadata.lumens}
            </Typography>
          )}
        </Box>
      )}
      
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: '#000000',
          p: 2,
          borderRadius: 1,
        }}
      >
        <img
          src={canvas.toDataURL()}
          alt="IES Profile"
          style={{
            maxWidth: '100%',
            height: 'auto',
          }}
        />
      </Box>
      
      {show3D && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>
            3D visualization would be rendered here
          </Typography>
        </Box>
      )}
    </Paper>
  );
};


