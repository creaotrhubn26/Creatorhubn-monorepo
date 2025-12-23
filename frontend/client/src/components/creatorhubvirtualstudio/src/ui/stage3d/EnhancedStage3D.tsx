/**
 * Enhanced Stage3D with Professional Rendering
 * Integrates EnhancedRenderer with PBR, GI, volumetrics, and soft shadows
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { logger } from '../../core/services/logger';

const log = logger.module('EnhancedStage3D, ');
import { EnhancedRenderer } from '../../core/rendering/EnhancedRenderer';
import { AreaLight } from '../../core/rendering/AreaLight';
import { equipmentIntegrationService } from '../../core/services/equipmentIntegrationService';
import { StudioGuidesHelper, GuideConfig } from '../components/StudioGuidesHelper';
import { useAppStore, StudioGuideSettings } from '../../state/store';
import { monitorFeedService, MonitorLayout } from '../../core/services/monitorFeedService';
import { multiCameraRecordingService } from '../../core/services/multiCameraRecordingService';
import { directorModeService } from '../../core/services/directorModeService';

// Dynamic THREE import (same pattern as Stage3D)
let THREE: any = null;
try {
  THREE = require('three');
} catch {
  log.warn('THREE.js not available, ');
}

export interface EnhancedStage3DProps {
  // Rendering settings
  pbrEnabled: boolean;
  giEnabled: boolean;
  volumetricsEnabled: boolean;
  softShadowsEnabled: boolean;
  giIntensity: number;
  giBounces: number;
  volumetricQuality: 'fast' | 'quality';

  // Area lights
  areaLights: AreaLight[];

  // Optional callbacks
  onRendererReady?: (renderer: EnhancedRenderer) => void;
  onSceneReady?: (scene: any) => void;
  
  // Drag and drop callbacks
  onEquipmentDrop?: (item: any, position: [number, number, number]) => void;
}

export const EnhancedStage3D: React.FC<EnhancedStage3DProps> = ({
  pbrEnabled,
  giEnabled,
  volumetricsEnabled,
  softShadowsEnabled,
  giIntensity,
  giBounces,
  volumetricQuality,
  areaLights,
  onRendererReady,
  onSceneReady,
  onEquipmentDrop,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<EnhancedRenderer | null>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const guidesHelperRef = useRef<StudioGuidesHelper | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // Raycaster for drag-drop positioning
  const raycasterRef = useRef<any>(null);
  const mouseRef = useRef<any>(null);
  const groundPlaneRef = useRef<any>(null);
  
  // Initialize raycaster
  useEffect(() => {
    if (!THREE) return;
    raycasterRef.current = new THREE.Raycaster();
    mouseRef.current = new THREE.Vector2();
    groundPlaneRef.current = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }, []);

  // Subscribe to studio guides settings changes
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      if (
        state.showStudioGuides !== prevState.showStudioGuides ||
        state.studioGuideSettings !== prevState.studioGuideSettings
      ) {
        if (guidesHelperRef.current && sceneRef.current) {
          if (state.showStudioGuides) {
            guidesHelperRef.current.updateConfig(state.studioGuideSettings);
            if (!sceneRef.current.children.includes(guidesHelperRef.current)) {
              sceneRef.current.add(guidesHelperRef.current);
            }
          } else {
            sceneRef.current.remove(guidesHelperRef.current);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);
  
  // Calculate 3D position from mouse coordinates
  const getWorldPositionFromMouse = useCallback((clientX: number, clientY: number): [number, number, number] => {
    if (!containerRef.current || !cameraRef.current || !raycasterRef.current) {
      return [0, 0, 0];
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    
    const planeIntersect = new THREE.Vector3();
    if (raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, planeIntersect)) {
      // Snap to 0.5m grid
      const gridSize = 0.5;
      return [
        Math.round(planeIntersect.x / gridSize) * gridSize,
        0,
        Math.round(planeIntersect.z / gridSize) * gridSize,
      ];
    }
    
    return [0, 0, 0];
  }, []);
  
  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingOver(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only hide if actually leaving the container
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        setIsDraggingOver(false);
      }
    }
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    try {
      const dataString = e.dataTransfer.getData('application/json');
      if (!dataString) return;
      
      const data = JSON.parse(dataString);
      const position = getWorldPositionFromMouse(e.clientX, e.clientY);
      
      if (data.type === 'equipment') {
        // Create scene node and add to scene
        const node = equipmentIntegrationService.createSceneNode(
          data.item.modelFunction,
          data.options || data.item.defaultOptions,
          data.item.name,
          position
        );
        equipmentIntegrationService.addToScene(node);
        
        // Notify parent
        onEquipmentDrop?.(data.item, position);
      }
    } catch (err) {
      log.error('Error handling drop: ', err);
    }
  }, [getWorldPositionFromMouse, onEquipmentDrop]);
  
  // Click handler for monitor zoom (Director Mode)
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !raycasterRef.current || !sceneRef.current || !THREE) {
      return;
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    
    // Check for intersections with monitors
    const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children, true);
    
    for (const intersect of intersects) {
      // Check if we clicked on a monitor
      let obj = intersect.object;
      while (obj) {
        if (obj.name?.startsWith('director-monitor-')) {
          const monitorId = obj.name.replace('director-monitor-', ',');
          directorModeService.enterDirectorMode(monitorId);
          log.info('Clicked on monitor:', monitorId);
          return;
        }
        obj = obj.parent;
      }
    }
  }, []);

  // Initialize renderer and scene
  useEffect(() => {
    if (!canvasRef.current || !THREE) return;

    try {
      // Create scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a1a);
      sceneRef.current = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(
        50,
        canvasRef.current.clientWidth / canvasRef.current.clientHeight,
        0.1,
        100
      );
      camera.position.set(3, 3, 3);
      camera.lookAt(0, 1.6, 0);
      cameraRef.current = camera;

      // Create enhanced renderer
      const renderer = new EnhancedRenderer(canvasRef.current, {
        width: canvasRef.current.clientWidth,
        height: canvasRef.current.clientHeight,
        enablePBR: pbrEnabled,
        enableGI: giEnabled,
        enableVolumetrics: volumetricsEnabled,
        enableSoftShadows: softShadowsEnabled,
        enableVSMShadows: false, // Will be toggled via renderer methods
        enableFalseColor: false, // Will be toggled via renderer methods
        enableLuminanceHeatmap: false, // Will be toggled via renderer methods
        giIntensity,
        giBounces,
        volumetricQuality,
        enableShadows: true,
        shadowMapSize: 2048,
        toneMapping: 'ACES',
        toneMappingExposure: 1.0,
        enableBloom: true,
        enableDOF: false,
        antialiasing: true,
      });
      rendererRef.current = renderer;

      // Add basic scene content
      setupScene(scene);

      // Add studio guides helper
      const guideState = useAppStore.getState();
      if (guideState.showStudioGuides) {
        const guidesHelper = new StudioGuidesHelper(guideState.studioGuideSettings);
        guidesHelperRef.current = guidesHelper;
        scene.add(guidesHelper);
      }

      // Notify parent components
      onRendererReady?.(renderer);
      onSceneReady?.(scene);
      
      // Register scene and main camera with multi-camera recording service
      multiCameraRecordingService.setScene(scene);
      multiCameraRecordingService.registerCamera(
        'main-camera', 'Main Camera',
        camera,
        () => ({
          position: camera.position.clone(),
          rotation: camera.quaternion.clone(),
          fov: camera.fov,
        })
      );
      log.info('Registered main camera with recording service');
      
      // Register camera with director mode service
      directorModeService.setCamera(camera);

      setIsLoading(false);

      // Start render loop
      const animate = () => {
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();

      // Handle resize
      const handleResize = () => {
        if (!canvasRef.current || !cameraRef.current || !rendererRef.current) return;
        
        const width = canvasRef.current.clientWidth;
        const height = canvasRef.current.clientHeight;
        
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        
        rendererRef.current.setSize(width, height);
      };
      
      window.addEventListener('resize', handleResize);

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (guidesHelperRef.current) {
          guidesHelperRef.current.dispose();
          guidesHelperRef.current = null;
        }
        if (rendererRef.current) {
          rendererRef.current.dispose();
        }
        // Unregister main camera from recording service
        multiCameraRecordingService.unregisterCamera('main-camera');
      };
    } catch (err) {
      log.error('Failed to initialize EnhancedStage3D:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  }, []);

  // Setup basic scene content
  const setupScene = (scene: any) => {
    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0xe5e7eb,
      roughness: 0.8,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Test cube
    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    const cubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a90e2,
      roughness: 0.5,
      metalness: 0.2,
    });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(0, 0.5, 0);
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);

    // Ambient light (fallback)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // Directional light (fallback)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);
  };

  // Update rendering settings
  useEffect(() => {
    if (!rendererRef.current) return;

    rendererRef.current.togglePBR(pbrEnabled);
    rendererRef.current.toggleGI(giEnabled);
    rendererRef.current.toggleVolumetrics(volumetricsEnabled);
    rendererRef.current.toggleSoftShadows(softShadowsEnabled);
    rendererRef.current.updateGISettings({ intensity: giIntensity, bounces: giBounces });
  }, [pbrEnabled, giEnabled, volumetricsEnabled, softShadowsEnabled, giIntensity, giBounces]);

  // Update area lights
  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current) return;

    // Remove old lights from renderer
    const currentLights = rendererRef.current.getAreaLights();
    currentLights.forEach((light) => {
      rendererRef.current!.removeAreaLight(light);
      sceneRef.current!.remove(light);
    });

    // Add new lights
    areaLights.forEach((light) => {
      rendererRef.current!.addAreaLight(light);
      sceneRef.current!.add(light);
    });
  }, [areaLights]);
  
  // Director Monitor mesh references
  const monitorMeshesRef = useRef<Map<string, any>>(new Map());
  const monitorTexturesRef = useRef<Map<string, any>>(new Map());
  
  // Create director monitor mesh
  const createMonitorMesh = useCallback((
    id: string,
    position: [number, number, number],
    layout: MonitorLayout
  ) => {
    if (!THREE || !sceneRef.current) return;
    
    const width = 0.5;
    const height = 0.28;
    const bezelWidth = 0.02;
    
    // Create monitor group
    const monitorGroup = new THREE.Group();
    monitorGroup.name = `director-monitor-${id}`;
    monitorGroup.position.set(position[0], position[1], position[2]);
    
    // Create frame (bezel + back)
    const frameGeom = new THREE.BoxGeometry(
      width + bezelWidth * 2,
      height + bezelWidth * 2,
      0.04
    );
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.7,
      metalness: 0.3,
    });
    const frame = new THREE.Mesh(frameGeom, frameMat);
    frame.position.z = -0.02;
    monitorGroup.add(frame);
    
    // Create screen
    const screenGeom = new THREE.PlaneGeometry(width, height);
    
    // Initialize monitor feed service for this scene
    const renderer = monitorFeedService.init(512, 288);
    renderer.setScene(sceneRef.current);
    renderer.setConfig({ layout });
    
    // Create canvas texture for the screen
    const canvas = renderer.getCanvas();
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    const screenMat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.FrontSide,
    });
    const screen = new THREE.Mesh(screenGeom, screenMat);
    screen.position.z = 0.001;
    monitorGroup.add(screen);
    
    // Create stand
    const standGeom = new THREE.CylinderGeometry(0.02, 0.03, 0.3, 8);
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.5,
      metalness: 0.5,
    });
    const stand = new THREE.Mesh(standGeom, standMat);
    stand.position.set(0, -height / 2 - 0.15, -0.05);
    monitorGroup.add(stand);
    
    // Create base
    const baseGeom = new THREE.CylinderGeometry(0.1, 0.12, 0.02, 16);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.5,
      metalness: 0.5,
    });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.set(0, -height / 2 - 0.28, -0.05);
    base.rotation.x = -Math.PI / 2;
    monitorGroup.add(base);
    
    // Add to scene
    sceneRef.current.add(monitorGroup);
    monitorMeshesRef.current.set(id, { group: monitorGroup, screen, texture, renderer });
    
    // Register with director mode service for click-to-zoom
    directorModeService.registerMonitor({
      id,
      name: `Monitor ${id.substring(0, 8)}`,
      position,
      rotation: [0, 0, 0],
    });
    
    log.info('Created director monitor mesh:', id);
    
    return monitorGroup;
  }, []);
  
  // Update monitor textures in render loop
  useEffect(() => {
    if (!sceneRef.current) return;
    
    const updateMonitors = () => {
      monitorMeshesRef.current.forEach(({ texture, renderer }) => {
        if (renderer && texture) {
          renderer.render();
          texture.needsUpdate = true;
        }
      });
    };
    
    // Add to animation loop
    const originalAnimate = animationFrameRef.current;
    const animate = () => {
      updateMonitors();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    // This will integrate into the existing animation loop
    // For now, the monitors update in their own service's render call
    
    return () => {
      // Cleanup monitor meshes
      monitorMeshesRef.current.forEach(({ group, texture }) => {
        if (sceneRef.current && group) {
          sceneRef.current.remove(group);
        }
        texture?.dispose();
      });
      monitorMeshesRef.current.clear();
    };
  }, []);
  
  // Listen for director monitor events
  useEffect(() => {
    const handleAddMonitor = (e: CustomEvent) => {
      const { id, position, layout } = e.detail;
      if (id && position) {
        createMonitorMesh(id, position, layout || 'single');
      }
    };
    
    window.addEventListener('vs-add-director-monitor', handleAddMonitor as EventListener);
    
    return () => {
      window.removeEventListener('vs-add-director-monitor', handleAddMonitor as EventListener);
    };
  }, [createMonitorMesh]);
  
  // Listen for camera additions to register with recording service
  useEffect(() => {
    if (!sceneRef.current || !THREE) return;
    
    const handleAddCamera = (e: CustomEvent) => {
      const { id, name, position, rotation, fov } = e.detail;
      if (!id) return;
      
      // Create a Three.js camera for this node
      const camera = new THREE.PerspectiveCamera(
        fov || 50,
        16 / 9,
        0.1,
        1000
      );
      
      if (position) {
        camera.position.set(position[0], position[1], position[2]);
      }
      if (rotation) {
        camera.rotation.set(rotation[0], rotation[1], rotation[2]);
      }
      
      // Add to scene
      sceneRef.current.add(camera);
      
      // Register with recording service
      multiCameraRecordingService.registerCamera(
        id,
        name || `Camera ${id.substring(0, 8)}`,
        camera,
        () => ({
          position: camera.position.clone(),
          rotation: camera.quaternion.clone(),
          fov: camera.fov,
        })
      );
      
      log.info('Registered new camera with recording service:', id);
    };
    
    const handleRemoveCamera = (e: CustomEvent) => {
      const { id } = e.detail;
      if (id) {
        multiCameraRecordingService.unregisterCamera(id);
        log.info('Unregistered camera from recording service:', id);
      }
    };
    
    const handleUpdateCamera = (e: CustomEvent) => {
      const { id, position, rotation, fov } = e.detail;
      if (!id) return;
      
      // Find camera in scene and update it
      sceneRef.current?.traverse((obj: any) => {
        if (obj.isCamera && obj.userData.cameraId === id) {
          if (position) obj.position.set(position[0], position[1], position[2]);
          if (rotation) obj.rotation.set(rotation[0], rotation[1], rotation[2]);
          if (fov !== undefined) {
            obj.fov = fov;
            obj.updateProjectionMatrix();
          }
        }
      });
    };
    
    window.addEventListener('vs-add-camera', handleAddCamera as EventListener);
    window.addEventListener('vs-remove-camera', handleRemoveCamera as EventListener);
    window.addEventListener('vs-update-camera', handleUpdateCamera as EventListener);
    
    return () => {
      window.removeEventListener('vs-add-camera', handleAddCamera as EventListener);
      window.removeEventListener('vs-remove-camera', handleRemoveCamera as EventListener);
      window.removeEventListener('vs-update-camera', handleUpdateCamera as EventListener);
    };
  }, []);
  
  // Director Mode Camera Control Event Handlers
  useEffect(() => {
    if (!cameraRef.current || !THREE) return;
    
    // Store for scene cameras (keyed by ID)
    const sceneCameras = new Map<string, any>();
    sceneCameras.set('main-camera', cameraRef.current);
    
    // Get camera by ID (returns main camera if ID matches or not found)
    const getCamera = (cameraId: string) => {
      if (cameraId === 'main-camera' || !sceneCameras.has(cameraId)) {
        return cameraRef.current;
      }
      return sceneCameras.get(cameraId);
    };
    
    // Handle camera movement (dolly, truck, pedestal)
    const handleCameraMove = (e: CustomEvent) => {
      const { cameraId, direction, speed } = e.detail;
      const camera = getCamera(cameraId);
      if (!camera) return;
      
      const moveSpeed = (speed || 0.5) * 0.1; // Scale speed
      const dir = new THREE.Vector3();
      
      switch (direction) {
        case 'forward':
          camera.getWorldDirection(dir);
          camera.position.addScaledVector(dir, moveSpeed);
          break;
        case 'backward':
          camera.getWorldDirection(dir);
          camera.position.addScaledVector(dir, -moveSpeed);
          break;
        case 'left':
          camera.getWorldDirection(dir);
          dir.cross(camera.up).normalize();
          camera.position.addScaledVector(dir, -moveSpeed);
          break;
        case 'right':
          camera.getWorldDirection(dir);
          dir.cross(camera.up).normalize();
          camera.position.addScaledVector(dir, moveSpeed);
          break;
        case 'up':
          camera.position.y += moveSpeed;
          break;
        case 'down':
          camera.position.y -= moveSpeed;
          break;
      }
      
      log.debug('Camera move:', { cameraId, direction, speed, position: camera.position.toArray() });
    };
    
    // Handle camera rotation (pan, tilt, roll)
    const handleCameraRotate = (e: CustomEvent) => {
      const { cameraId, axis, amount } = e.detail;
      const camera = getCamera(cameraId);
      if (!camera) return;
      
      const rotateSpeed = (amount || 1) * 0.02; // Scale rotation (radians)
      
      switch (axis) {
        case 'pan': // Horizontal rotation around Y axis
          camera.rotateY(-rotateSpeed);
          break;
        case 'tilt': // Vertical rotation around X axis
          camera.rotateX(rotateSpeed);
          break;
        case 'roll': // Roll rotation around Z axis
          camera.rotateZ(rotateSpeed);
          break;
      }
      
      log.debug('Camera rotate:', { cameraId, axis, amount, rotation: camera.rotation.toArray() });
    };
    
    // Handle camera zoom (FOV change)
    const handleCameraZoom = (e: CustomEvent) => {
      const { cameraId, amount } = e.detail;
      const camera = getCamera(cameraId);
      if (!camera || !camera.isPerspectiveCamera) return;
      
      const zoomSpeed = (amount || 0.1) * 10; // Scale zoom
      camera.fov = Math.max(10, Math.min(120, camera.fov - zoomSpeed));
      camera.updateProjectionMatrix();
      
      log.debug('Camera zoom:', { cameraId, amount, fov: camera.fov });
    };
    
    // Handle camera reset
    const handleCameraReset = (e: CustomEvent) => {
      const { cameraId } = e.detail;
      const camera = getCamera(cameraId);
      if (!camera) return;
      
      // Reset to default position
      camera.position.set(3, 3, 3);
      camera.rotation.set(0, 0, 0);
      camera.lookAt(0, 1.6, 0);
      
      if (camera.isPerspectiveCamera) {
        camera.fov = 50;
        camera.updateProjectionMatrix();
      }
      
      log.info('Camera reset:', cameraId);
    };
    
    // Subscribe to camera control events
    window.addEventListener('vs-camera-move', handleCameraMove as EventListener);
    window.addEventListener('vs-camera-rotate', handleCameraRotate as EventListener);
    window.addEventListener('vs-camera-zoom', handleCameraZoom as EventListener);
    window.addEventListener('vs-camera-reset', handleCameraReset as EventListener);
    
    return () => {
      window.removeEventListener('vs-camera-move', handleCameraMove as EventListener);
      window.removeEventListener('vs-camera-rotate', handleCameraRotate as EventListener);
      window.removeEventListener('vs-camera-zoom', handleCameraZoom as EventListener);
      window.removeEventListener('vs-camera-reset', handleCameraReset as EventListener);
    };
  }, []);

  if (!THREE) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          color: '#fff',
          p: 3}}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            THREE.js Required
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Install three.js to enable enhanced rendering
          </Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          color: '#fff',
          p: 3}}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" color="error" gutterBottom>
            Renderer Error
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        border: isDraggingOver ? '3px dashed #00ff88' : '3px solid transparent',
        transition: 'border-color 0.2s ease'}}
    >
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            zIndex: 1}}
        >
          <CircularProgress />
        </Box>
      )}
      
      {/* Drag overlay indicator */}
      {isDraggingOver && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '16px 32px',
            backgroundColor: 'rgba(0, 255, 136, 0.15)',
            border: '2px dashed rgba(0, 255, 136, 0.6)',
            borderRadius: 2,
            color: '#00ff88',
            fontSize: 16,
            fontWeight: 600,
            backdropFilter: 'blur(4px)',
            zIndex: 2,
            pointerEvents: 'none'}}
        >
          Drop to place equipment
        </Box>
      )}
      
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor:'pointer'}}
      />
    </Box>
  );
};

export default EnhancedStage3D;

