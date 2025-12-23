/**
 * Luminance Heatmap Component
 * 
 * Visual heatmap showing luminance distribution across the scene
 * Helps with exposure analysis
 */

import React, { useMemo } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import * as THREE from 'three';
import { photometricCalculator } from '../../core/services/photometric';
import type { LightSourceConfig } from '../../core/services/photometric';

interface LuminanceHeatmapProps {
  lights: Array<{
    id: string;
    position: [number, number, number];
    power: number;
    beamAngle?: number;
    wattage?: number;
    efficacy?: number;
  }>;
  resolution?: number; // Heatmap resolution
  showLegend?: boolean;
}

export const LuminanceHeatmap: React.FC<LuminanceHeatmapProps> = ({
  lights,
  resolution = 64,
  showLegend = true,
}) => {
  const heatmapData = useMemo(() => {
    const data: number[][] = [];
    const step = 0.5; // Meters per pixel
    const size = resolution * step;
    const offset = size / 2;
    
    let minLux = Infinity;
    let maxLux = -Infinity;
    
    // Calculate luminance at each point
    for (let y = 0; y < resolution; y++) {
      const row: number[] = [];
      for (let x = 0; x < resolution; x++) {
        const worldX = (x / resolution) * size - offset;
        const worldZ = (y / resolution) * size - offset;
        const worldY = 1.6; // Subject height
        
        const targetPoint = new THREE.Vector3(worldX, worldY, worldZ);
        const surfaceNormal = new THREE.Vector3(0, 1, 0);
        
        let totalLux = 0;
        
        lights.forEach((light) => {
          const lightConfig: LightSourceConfig = {
            power: light.power,
            wattage: light.wattage,
            efficacy: light.efficacy,
            position: new THREE.Vector3(...light.position),
            beamAngle: light.beamAngle,
            distance: new THREE.Vector3(...light.position).distanceTo(targetPoint),
          };
          
          const lux = photometricCalculator.calculateIlluminance(
            lightConfig,
            targetPoint,
            surfaceNormal
          );
          
          totalLux += lux;
        });
        
        row.push(totalLux);
        minLux = Math.min(minLux, totalLux);
        maxLux = Math.max(maxLux, totalLux);
      }
      data.push(row);
    }
    
    return { data, minLux, maxLux };
  }, [lights, resolution]);
  
  const getColor = (lux: number): string => {
    const { minLux, maxLux } = heatmapData;
    if (maxLux === minLux) return '#000000';
    
    const normalized = (lux - minLux) / (maxLux - minLux);
    
    // Color gradient: blue (low) -> green -> yellow -> red (high)
    if (normalized < 0.25) {
      const t = normalized / 0.25;
      const r = Math.round(0 + t * 0);
      const g = Math.round(0 + t * 128);
      const b = Math.round(255 - t * 128);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (normalized < 0.5) {
      const t = (normalized - 0.25) / 0.25;
      const r = Math.round(0 + t * 255);
      const g = Math.round(128 + t * 127);
      const b = Math.round(128 - t * 128);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (normalized < 0.75) {
      const t = (normalized - 0.5) / 0.25;
      const r = 255;
      const g = Math.round(255 - t * 128);
      const b = 0;
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const t = (normalized - 0.75) / 0.25;
      const r = 255;
      const g = Math.round(127 - t * 127);
      const b = Math.round(0 + t * 0);
      return `rgb(${r}, ${g}, ${b})`;
    }
  };
  
  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'rgba(26, 26, 26, 0.95)',
        color: '#ffffff',
      }}
    >
      <Typography variant="h6" sx={{ mb: 2, color: '#ffffff' }}>
        Luminance Heatmap
      </Typography>
      
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1',
          border: '1px solid #444',
        }}
      >
        <canvas
          width={resolution}
          height={resolution}
          style={{
            width: '100%',
            height: '100%',
            imageRendering: 'pixelated',
          }}
          ref={(canvas) => {
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            const imageData = ctx.createImageData(resolution, resolution);
            
            for (let y = 0; y < resolution; y++) {
              for (let x = 0; x < resolution; x++) {
                const lux = heatmapData.data[y][x];
                const color = getColor(lux);
                const match = color.match(/rgb\((\d+), (\d+), (\d+)\)/);
                
                if (match) {
                  const idx = (y * resolution + x) * 4;
                  imageData.data[idx] = parseInt(match[1]);
                  imageData.data[idx + 1] = parseInt(match[2]);
                  imageData.data[idx + 2] = parseInt(match[3]);
                  imageData.data[idx + 3] = 255;
                }
              }
            }
            
            ctx.putImageData(imageData, 0, 0);
          }}
        />
      </Box>
      
      {showLegend && (
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" sx={{ color: '#aaaaaa' }}>
            Min: {heatmapData.minLux.toFixed(0)} lux
          </Typography>
          <Box
            sx={{
              flex: 1,
              height: 20,
              background: 'linear-gradient(to right, rgb(0,0,255), rgb(0,255,0), rgb(255,255,0), rgb(255,0,0))',
              border: '1px solid #444',
            }}
          />
          <Typography variant="caption" sx={{ color: '#aaaaaa' }}>
            Max: {heatmapData.maxLux.toFixed(0)} lux
          </Typography>
        </Box>
      )}
    </Paper>
  );
};


