/**
 * CameraPanel - Integrated Camera System
 *
 * Combines CameraControls and LensSelector
 * Wires everything to Zustand store and EnhancedRenderer
 */

import React, { useEffect, useState } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('CameraPanel');
import { Box, Stack, Tabs, Tab } from '@mui/material';
import { CameraControls, CameraSettings } from '../controls/CameraControls';
import { LensSelector, LensSettings } from '../controls/LensSelector';
import { useAppStore } from '@/state/store';
import { getActiveCameraId } from '@/core/services/viewports';

export function CameraPanel() {
  const { scene, updateNode } = useAppStore();
  const [activeTab, setActiveTab] = useState(0);

  // Find active camera node
  const activeCameraId = getActiveCameraId();
  const cameraNode = activeCameraId
    ? scene.nodes.find((n) => n.id === activeCameraId)
    : scene.nodes.find((n) => n.camera);

  // Initialize settings from camera node
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>(() => {
    if (cameraNode?.camera) {
      return {
        aperture: cameraNode.camera.aperture || 2.8,
        iso: cameraNode.camera.iso || 100,
        shutter: cameraNode.camera.shutter || 1 / 125,
        focusDistance: cameraNode.userData?.focusDistance || 3.0,
        focalLength: cameraNode.camera.focalLength || 50,
      };
    }
    return {
      aperture: 2.8,
      iso: 100,
      shutter: 1 / 125,
      focusDistance: 3.0,
      focalLength: 50,
    };
  });

  const [lensSettings, setLensSettings] = useState<LensSettings>(() => {
    if (cameraNode?.camera) {
      return {
        focalLength: cameraNode.camera.focalLength || 50,
        sensor: cameraNode.camera.sensor || [36, 24],
      };
    }
    return {
      focalLength: 50,
      sensor: [36, 24],
    };
  });

  // Sync camera node changes back to local state
  useEffect(() => {
    if (cameraNode?.camera) {
      setCameraSettings({
        aperture: cameraNode.camera.aperture || 2.8,
        iso: cameraNode.camera.iso || 100,
        shutter: cameraNode.camera.shutter || 1 / 125,
        focusDistance: cameraNode.userData?.focusDistance || 3.0,
        focalLength: cameraNode.camera.focalLength || 50,
      });

      setLensSettings({
        focalLength: cameraNode.camera.focalLength || 50,
        sensor: cameraNode.camera.sensor || [36, 24],
      });
    }
  }, [cameraNode]);

  // Handle camera settings change
  const handleCameraSettingsChange = (newSettings: CameraSettings) => {
    setCameraSettings(newSettings);

    if (cameraNode) {
      // Update store
      updateNode(cameraNode.id, {
        camera: {
          ...cameraNode.camera,
          aperture: newSettings.aperture,
          iso: newSettings.iso,
          shutter: newSettings.shutter,
          focalLength: newSettings.focalLength,
        },
        userData: {
          ...cameraNode.userData,
          focusDistance: newSettings.focusDistance,
        },
      });

      // Update EnhancedRenderer (if available)
      // The EnhancedRenderer will pick up changes from the histogram canvas render loop
      log.debug('Camera settings updated: ', {
        aperture: newSettings.aperture,
        iso: newSettings.iso,
        shutter: newSettings.shutter,
        focusDistance: newSettings.focusDistance,
      });
    }
  };

  // Handle lens settings change
  const handleLensSettingsChange = (newSettings: LensSettings) => {
    setLensSettings(newSettings);

    if (cameraNode) {
      // Update store
      updateNode(cameraNode.id, {
        camera: {
          ...cameraNode.camera,
          focalLength: newSettings.focalLength,
          sensor: newSettings.sensor,
        },
      });

      // Also update camera settings focal length
      setCameraSettings((prev) => ({
        ...prev,
        focalLength: newSettings.focalLength,
      }));

      log.debug('Lens settings updated:', {
        focalLength: newSettings.focalLength,
        sensor: newSettings.sensor,
      });
    }
  };

  // Handle reset
  const handleReset = () => {
    const defaultSettings: CameraSettings = {
      aperture: 2.8,
      iso: 100,
      shutter: 1 / 125,
      focusDistance: 3.0,
      focalLength: 50,
    };

    const defaultLensSettings: LensSettings = {
      focalLength: 50,
      sensor: [36, 24],
    };

    setCameraSettings(defaultSettings);
    setLensSettings(defaultLensSettings);

    if (cameraNode) {
      updateNode(cameraNode.id, {
        camera: {
          ...cameraNode.camera,
          aperture: defaultSettings.aperture,
          iso: defaultSettings.iso,
          shutter: defaultSettings.shutter,
          focalLength: defaultSettings.focalLength,
          sensor: defaultLensSettings.sensor,
        },
        userData: {
          ...cameraNode.userData,
          focusDistance: defaultSettings.focusDistance,
        },
      });
    }
  };

  if (!cameraNode) {
    return (
      <Box sx={{ p: 2 }}>
        <div>No camera in scene. Add a camera to use controls.</div>
      </Box>
    );
  }

  return (
    <Box>
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor:'divider' }}
      >
        <Tab label="Camera" />
        <Tab label="Lens" />
      </Tabs>

      <Box sx={{ pt: 2 }}>
        {activeTab === 0 && (
          <CameraControls
            settings={cameraSettings}
            onChange={handleCameraSettingsChange}
            onReset={handleReset}
          />
        )}

        {activeTab === 1 && (
          <LensSelector settings={lensSettings} onChange={handleLensSettingsChange} />
        )}
      </Box>
    </Box>
  );
}
