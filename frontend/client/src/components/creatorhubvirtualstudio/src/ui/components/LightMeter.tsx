/**
 * Light Meter Component
 * 
 * Visual light meter showing illuminance (lux/foot-candles) on model surface
 * Displays real-time photometric measurements
 */

import React, { useMemo } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import * as THREE from 'three';
import { photometricCalculator } from '../../core/services/photometric';
import type { LightSourceConfig } from '../../core/services/photometric';

interface LightMeterProps {
  lights: Array<{
    id: string;
    position: [number, number, number];
    power: number;
    beamAngle?: number;
    wattage?: number;
    efficacy?: number;
  }>;
  targetPoint: [number, number, number];
  surfaceNormal?: [number, number, number];
  showFootCandles?: boolean;
  unit?: 'lux' | 'fc' | 'both';
}

export const LightMeter: React.FC<LightMeterProps> = ({
  lights,
  targetPoint,
  surfaceNormal = [0, 1, 0],
  showFootCandles = false,
  unit = 'both',
}) => {
  const measurements = useMemo(() => {
    const targetVec = new THREE.Vector3(...targetPoint);
    const normalVec = new THREE.Vector3(...surfaceNormal);
    
    let totalLux = 0;
    const lightContributions: Array<{
      id: string;
      lux: number;
      footCandles: number;
      percentage: number;
    }> = [];
    
    // Calculate illuminance from each light
    lights.forEach((light) => {
      const lightConfig: LightSourceConfig = {
        power: light.power,
        wattage: light.wattage,
        efficacy: light.efficacy,
        position: new THREE.Vector3(...light.position),
        beamAngle: light.beamAngle,
        distance: new THREE.Vector3(...light.position).distanceTo(targetVec),
      };
      
      const lux = photometricCalculator.calculateIlluminance(
        lightConfig,
        targetVec,
        normalVec
      );
      
      totalLux += lux;
      lightContributions.push({
        id: light.id,
        lux,
        footCandles: photometricCalculator.luxToFootCandles(lux),
        percentage: 0, // Will calculate after total
      });
    });
    
    // Calculate percentages
    if (totalLux > 0) {
      lightContributions.forEach((contrib) => {
        contrib.percentage = (contrib.lux / totalLux) * 100;
      });
    }
    
    return {
      totalLux,
      totalFootCandles: photometricCalculator.luxToFootCandles(totalLux),
      contributions: lightContributions,
    };
  }, [lights, targetPoint, surfaceNormal]);
  
  // Determine exposure zone (Ansel Adams zone system)
  const getExposureZone = (lux: number): { zone: number; description: string; color: string } => {
    // Approximate conversion: 1 lux ≈ 0.1 EV at ISO 100
    // Zone V (middle gray) is typically around 100-200 lux
    const ev = Math.log2(lux / 2.5); // Approximate EV calculation
    
    if (ev < -2) {
      return { zone: 0, description: 'Pure Black', color: '#000000' };
    } else if (ev < -1) {
      return { zone: 1, description: 'Near Black', color: '#1a1a1a' };
    } else if (ev < 0) {
      return { zone: 2, description: 'Very Dark', color: '#333333' };
    } else if (ev < 1) {
      return { zone: 3, description: 'Dark', color: '#4d4d4d' };
    } else if (ev < 2) {
      return { zone: 4, description: 'Dark Gray', color: '#666666' };
    } else if (ev < 3) {
      return { zone: 5, description: 'Middle Gray', color: '#808080' };
    } else if (ev < 4) {
      return { zone: 6, description: 'Light Gray', color: '#999999' };
    } else if (ev < 5) {
      return { zone: 7, description: 'Light', color: '#b3b3b3' };
    } else if (ev < 6) {
      return { zone: 8, description: 'Very Light', color: '#cccccc' };
    } else if (ev < 7) {
      return { zone: 9, description: 'Near White', color: '#e6e6e6' };
    } else {
      return { zone: 10, description: 'Pure White', color: '#ffffff' };
    }
  };
  
  const exposureZone = getExposureZone(measurements.totalLux);
  
  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'rgba(26, 26, 26, 0.95)',
        color: '#ffffff',
        borderRadius: 2,
        minWidth: 280,
      }}
    >
      <Typography variant="h6" sx={{ mb: 2, color: '#ffffff' }}>
        Light Meter
      </Typography>
      
      {/* Total Illuminance */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ color: '#aaaaaa', mb: 0.5 }}>
          Total Illuminance
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          {(unit === 'lux' || unit === 'both') && (
            <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 'bold' }}>
              {measurements.totalLux.toFixed(1)} lux
            </Typography>
          )}
          {(unit === 'fc' || unit === 'both') && (
            <Typography variant="body1" sx={{ color: '#888888' }}>
              ({measurements.totalFootCandles.toFixed(1)} fc)
            </Typography>
          )}
        </Box>
      </Box>
      
      {/* Exposure Zone */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ color: '#aaaaaa', mb: 0.5 }}>
          Exposure Zone
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: 1,
              bgcolor: exposureZone.color,
              border: '1px solid #444',
            }}
          />
          <Typography variant="body1" sx={{ color: '#ffffff' }}>
            Zone {exposureZone.zone}: {exposureZone.description}
          </Typography>
        </Box>
      </Box>
      
      {/* Light Contributions */}
      {measurements.contributions.length > 1 && (
        <Box>
          <Typography variant="body2" sx={{ color: '#aaaaaa', mb: 1 }}>
            Light Contributions
          </Typography>
          {measurements.contributions.map((contrib) => (
            <Box
              key={contrib.id}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 0.5,
              }}
            >
              <Typography variant="caption" sx={{ color: '#888888' }}>
                Light {contrib.id.slice(0, 8)}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: '#ffffff' }}>
                  {contrib.lux.toFixed(0)} lux
                </Typography>
                <Box
                  sx={{
                    width: 60,
                    height: 4,
                    bgcolor: '#333',
                    borderRadius: 1,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      width: `${contrib.percentage}%`,
                      height: '100%',
                      bgcolor: '#4a9eff',
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#888888', minWidth: 40 }}>
                  {contrib.percentage.toFixed(0)}%
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
};


