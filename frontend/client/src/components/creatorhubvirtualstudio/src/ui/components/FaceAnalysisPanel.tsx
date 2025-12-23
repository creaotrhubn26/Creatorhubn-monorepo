/**
 * Face Analysis Panel
 * 
 * FaceXFormer integration for face analysis in Virtual Studio
 * Supports: parsing, landmarks, headpose, attributes
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  FormControlLabel,
  Checkbox,
  Paper,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Chip,
  Stack,
  Divider,
} from '@mui/material';
import {
  Face as FaceIcon,
  Image as ImageIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  CameraAlt as CaptureIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { faceXFormerService, type FaceAnalysisTask } from '../../services/FaceXFormerService';
import { sam2Service } from '@/services/SAM2Service';
import { logger } from '../../core/services/logger';
import { getR3FCanvas } from '../../core/services/viewports';
import { useActions, useNodes } from '../../state/selectors';
import { useFaceAnalysis } from '../../contexts/FaceAnalysisContext';
import {
  calculateCameraAdjustment,
  calculateFaceAwareLighting,
  calculateCompositionGuides,
  applyCameraAdjustment,
  applyLightingAdjustments,
  getRecommendedCameraSettings,
  type FaceAnalysisResults,
} from '../../services/FaceAnalysisEnhancements';
import { faceAnalysisHistory, type AnalysisSnapshot } from '../../services/FaceAnalysisHistory';

const log = logger.module('FaceAnalysisPanel, ');

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`face-analysis-tabpanel-${index}`}
      aria-labelledby={`face-analysis-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export function FaceAnalysisPanel() {
  const [selectedTasks, setSelectedTasks] = useState<Set<FaceAnalysisTask>>(new Set(['all']));
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  // Enhancement settings
  const [autoAdjustCamera, setAutoAdjustCamera] = useState(true);
  const [faceAwareLighting, setFaceAwareLighting] = useState(true);
  const [showCompositionGuides, setShowCompositionGuides] = useState(true);
  const [realtimeAnalysis, setRealtimeAnalysis] = useState(false);
  
  // Store access
  const storeActions = useActions();
  const nodes = useNodes();
  
  // Composition guides state
  const [compositionGuides, setCompositionGuides] = useState<any>(null);
  
  // Analysis history state
  const [historyStats, setHistoryStats] = useState(faceAnalysisHistory.getStats());
  
  // Real-time analysis
  const realtimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalysisTimeRef = useRef<number>(0);
  const REALTIME_INTERVAL_MS = 2000; // Analyze every 2 seconds when enabled
  
  // Background analysis
  const backgroundIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastBackgroundAnalysisRef = useRef<number>(0);
  const lastSceneHashRef = useRef<string>(', ');
  const isAnalyzingRef = useRef<boolean>(false);
  const backgroundTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const tasks: Array<{ value: FaceAnalysisTask; label: string; description: string }> = [
    { value: 'all', label: 'All Tasks', description: 'Run all analysis tasks' },
    { value: 'parsing', label: 'Face Parsing', description: 'Face segmentation/parsing' },
    { value: 'landmarks', label: 'Landmarks', description: '68-point facial landmarks' },
    { value: 'headpose', label: 'Head Pose', description: '3D head orientation' },
    { value: 'attributes', label: 'Attributes', description: 'Face attribute recognition' },
  ];

  /**
   * Capture current 3D scene/model for analysis
   */
  const captureScene = useCallback(() => {
    try {
      const canvas = getR3FCanvas();
      if (!canvas) {
        setError('3D canvas not available. Please ensure the scene is loaded.');
        return;
      }

      // Capture canvas as image
      const imageData = canvas.toDataURL('image/png');
      setCapturedImage(imageData);
      setImagePreview(imageData);
      setError(null);
      setResults(null);
      
      log.info('Scene captured for face analysis');
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to capture scene';
      setError(errorMsg);
      log.error('Failed to capture scene', err);
    }
  }, []);

  const handleTaskToggle = useCallback((task: FaceAnalysisTask) => {
    setSelectedTasks((prev) => {
      const newSet = new Set(prev);
      if (task === 'all') {
        // Toggle all
        if (newSet.has('all')) {
          newSet.clear();
        } else {
          newSet.clear();
          newSet.add('all');
        }
      } else {
        // Toggle individual task
        newSet.delete('all');
        if (newSet.has(task)) {
          newSet.delete(task);
        } else {
          newSet.add(task);
        }
        // If all individual tasks selected, switch to 'all'
        if (newSet.size === tasks.length - 1) {
          newSet.clear();
          newSet.add('all');
        }
      }
      return newSet;
    });
  }, [tasks.length]);

  /**
   * Calculate scene hash to detect camera, model, and light changes
   * Watches camera position/rotation, model position/rotation, and light positions/power
   */
  const sceneHash = useMemo(() => {
    const cameraNode = nodes.find((n: any) => n.type === 'camera' || n.name?.toLowerCase().includes('camera'));
    const modelNode = nodes.find((n: any) => n.type === 'model' || n.name?.toLowerCase().includes('model'));
    const lightNodes = nodes.filter((n: any) => n.light);
    
    // Helper to round values
    const round = (v: number) => Math.round(v * 100) / 100;
    const roundArray = (arr: number[]) => arr.map(round);
    
    // Camera state
    const cameraPos = cameraNode?.transform?.position || [0, 0, 0];
    const cameraRot = cameraNode?.transform?.rotation || [0, 0, 0];
    
    // Model state
    const modelPos = modelNode?.transform?.position || [0, 0, 0];
    const modelRot = modelNode?.transform?.rotation || [0, 0, 0];
    
    // Light states (position, rotation, power)
    const lights = lightNodes.map((n: any) => ({
      id: n.id,
      pos: roundArray(n.transform?.position || [0, 0, 0]),
      rot: roundArray(n.transform?.rotation || [0, 0, 0]),
      power: round(n.light?.power || 0),
    })).sort((a, b) => a.id.localeCompare(b.id)); // Sort for consistent hashing
    
    return JSON.stringify({
      camera: { pos: roundArray(cameraPos), rot: roundArray(cameraRot) },
      model: { pos: roundArray(modelPos), rot: roundArray(modelRot) },
      lights: lights,
    });
  }, [nodes]);

  /**
   * Background auto-analysis effect
   * Runs automatically when camera, model, or lights change, without user interaction
   */
  useEffect(() => {
    if (backgroundAnalysis) {
      // Check if scene has changed (camera, model, or lights)
      const sceneChanged = sceneHash !== lastSceneHashRef.current;
      
      // Only analyze if scene changed or enough time has passed
      const timeSinceLastAnalysis = Date.now() - lastBackgroundAnalysisRef.current;
      const shouldAnalyze = sceneChanged || timeSinceLastAnalysis >= backgroundInterval;
      
      if (shouldAnalyze && !isAnalyzingRef.current && sceneHash) {
        isAnalyzingRef.current = true;
        lastSceneHashRef.current = sceneHash;
        
        // Run background analysis
        const runBackgroundAnalysis = async () => {
          try {
            const canvas = getR3FCanvas();
            if (!canvas) {
              isAnalyzingRef.current = false;
              return;
            }
            
            // Capture scene
            const imageData = canvas.toDataURL('image/png');
            const imageFile = dataURLtoFile(imageData, 'background-capture.png');
            
            // Run lightweight analysis (headpose only for speed)
            // Using 'trained' model (latest fine-tuned version)
            log.debug('Running background analysis (scene changed)...');
            const result = await faceXFormerService.analyzeFace(imageFile, 'headpose','trained');
            
            if (result?.results?.headpose) {
              lastBackgroundAnalysisRef.current = Date.now();
              
              // Store analysis data for overlay (always, even if auto-adjust is off)
              setAnalysisData({
                headPose: result.results.headpose,
                landmarks: undefined, // Not analyzed in background mode
                compositionGuides: undefined,
              });
              
              // Apply camera adjustment if enabled
              if (autoAdjustCamera) {
                const cameraNode = nodes.find((n: any) => 
                  n.type === 'camera' || n.name?.toLowerCase().includes('camera')
                );
                
                const currentCamera = cameraNode?.transform ? {
                  position: cameraNode.transform.position || [0, 1.65, 2],
                  rotation: cameraNode.transform.rotation || [0, 0, 0],
                } : undefined;
                
                const cameraAdjustment = calculateCameraAdjustment(result.results.headpose, currentCamera);
                applyCameraAdjustment(
                  cameraAdjustment,
                  storeActions.updateNode,
                  cameraNode?.id,
                  cameraNode
                );
                
                // Save to history (lightweight snapshot)
                faceAnalysisHistory.addSnapshot(
                  {
                    headpose: result.results.headpose,
                    landmarks: undefined,
                    parsing: undefined,
                    attributes: undefined,
                  },
                  cameraAdjustment,
                  undefined, // No lighting in background mode
                  undefined, // No composition guides
                  {
                    cameraNode: cameraNode,
                    lightNodes: undefined,
                  }
                );
                
                setHistoryStats(faceAnalysisHistory.getStats());
                log.debug('Background analysis completed (camera moved)', { cameraHash });
              } else {
                // Still save to history even if auto-adjust is off
                faceAnalysisHistory.addSnapshot(
                  {
                    headpose: result.results.headpose,
                    landmarks: undefined,
                    parsing: undefined,
                    attributes: undefined,
                  },
                  undefined, // No camera adjustment
                  undefined, // No lighting
                  undefined, // No composition guides
                  {
                    cameraNode: nodes.find((n: any) => n.type === 'camera'),
                    lightNodes: undefined,
                  }
                );
                setHistoryStats(faceAnalysisHistory.getStats());
                log.debug('Background analysis completed (camera moved, no auto-adjust)', { cameraHash });
              }
            }
          } catch (err) {
            log.error('Background analysis error', err);
          } finally {
            isAnalyzingRef.current = false;
          }
        };
        
        // Run analysis with debounce to avoid excessive analysis during camera dragging
        // Clear any existing timeout
        if (backgroundTimeoutRef.current) {
          clearTimeout(backgroundTimeoutRef.current);
        }
        
        backgroundTimeoutRef.current = setTimeout(() => {
          runBackgroundAnalysis();
        }, 500); // 500ms debounce
      }
    } else {
      // Stop background analysis
      if (backgroundTimeoutRef.current) {
        clearTimeout(backgroundTimeoutRef.current);
        backgroundTimeoutRef.current = null;
      }
      lastSceneHashRef.current = ', ';
      isAnalyzingRef.current = false;
    }
    
    // Cleanup function
    return () => {
      if (backgroundTimeoutRef.current) {
        clearTimeout(backgroundTimeoutRef.current);
        backgroundTimeoutRef.current = null;
      }
    };
  }, [backgroundAnalysis, sceneHash, backgroundInterval, autoAdjustCamera, nodes, storeActions, dataURLtoFile, setAnalysisData]);

  /**
   * Real-time analysis effect
   */
  useEffect(() => {
    if (realtimeAnalysis && capturedImage) {
      // Start real-time analysis loop
      realtimeIntervalRef.current = setInterval(async () => {
        const now = Date.now();
        // Throttle to avoid too frequent analysis
        if (now - lastAnalysisTimeRef.current < REALTIME_INTERVAL_MS) {
          return;
        }
        
        try {
          lastAnalysisTimeRef.current = now;
          
          // Re-capture scene
          const canvas = getR3FCanvas();
          if (!canvas) return;
          
          const imageData = canvas.toDataURL('image/png');
          const imageFile = dataURLtoFile(imageData, 'realtime-capture.png');
          
          // Run analysis with headpose only for real-time (faster)
          // Using 'trained' model (latest fine-tuned version)
          const result = await faceXFormerService.analyzeFace(imageFile, 'headpose','trained');
          
          if (result?.results?.headpose) {
            // Apply only camera adjustment for real-time (lighting changes can be jarring)
            if (autoAdjustCamera) {
              const cameraNode = nodes.find((n: any) => 
                n.type === 'camera' || n.name?.toLowerCase().includes('camera')
              );
              
              const currentCamera = cameraNode?.transform ? {
                position: cameraNode.transform.position || [0, 1.65, 2],
                rotation: cameraNode.transform.rotation || [0, 0, 0],
              } : undefined;
              
              const cameraAdjustment = calculateCameraAdjustment(result.results.headpose, currentCamera);
              applyCameraAdjustment(
                cameraAdjustment,
                storeActions.updateNode,
                cameraNode?.id,
                cameraNode
              );
            }
          }
        } catch (err) {
          log.error('Real-time analysis error', err);
        }
      }, REALTIME_INTERVAL_MS);
      
      return () => {
        if (realtimeIntervalRef.current) {
          clearInterval(realtimeIntervalRef.current);
          realtimeIntervalRef.current = null;
        }
      };
    } else {
      // Stop real-time analysis
      if (realtimeIntervalRef.current) {
        clearInterval(realtimeIntervalRef.current);
        realtimeIntervalRef.current = null;
      }
    }
  }, [realtimeAnalysis, capturedImage, autoAdjustCamera, nodes, storeActions, dataURLtoFile]);

  /**
   * Apply enhancements based on analysis results
   */
  const applyEnhancements = useCallback((result: any) => {
    if (!result?.results) return;

    const analysisResults: FaceAnalysisResults = {
      headpose: result.results.headpose,
      landmarks: result.results.landmarks,
      parsing: result.results.parsing,
      attributes: result.results.attributes,
    };

    // 1. Auto-adjust camera based on head pose
    if (autoAdjustCamera && analysisResults.headpose) {
      try {
        // Find camera node (typically has type 'camera' or name contains 'camera')
        const cameraNode = nodes.find((n: any) => 
          n.type === 'camera' || n.name?.toLowerCase().includes('camera')
        );
        
        // Get current camera transform for calculation
        const currentCamera = cameraNode?.transform ? {
          position: cameraNode.transform.position || [0, 1.65, 2],
          rotation: cameraNode.transform.rotation || [0, 0, 0],
        } : undefined;
        
        const cameraAdjustment = calculateCameraAdjustment(analysisResults.headpose, currentCamera);
        applyCameraAdjustment(
          cameraAdjustment,
          storeActions.updateNode,
          cameraNode?.id,
          cameraNode
        );
        log.info('Camera auto-adjusted based on head pose', cameraAdjustment);
      } catch (err) {
        log.error('Failed to adjust camera', err);
      }
    }

    // 2. Face-aware lighting (skip in real-time mode to avoid jarring changes)
    if (faceAwareLighting && !realtimeAnalysis && analysisResults.headpose && analysisResults.parsing) {
      try {
        const lightNodes = nodes.filter((n: any) => n.light);
        const lightingAdjustments = calculateFaceAwareLighting(analysisResults, lightNodes);
        if (lightingAdjustments.length > 0) {
          applyLightingAdjustments(lightingAdjustments, storeActions.updateNode, lightNodes);
          log.info('Face-aware lighting applied', { count: lightingAdjustments.length });
        } else {
          log.info('No lighting adjustments calculated (no matching lights found)');
        }
      } catch (err) {
        log.error('Failed to apply face-aware lighting', err);
      }
    }

    // 3. Composition guides
    if (showCompositionGuides && analysisResults.landmarks) {
      try {
        const guides = calculateCompositionGuides(analysisResults.landmarks);
        setCompositionGuides(guides);
        log.info('Composition guides calculated', guides);
      } catch (err) {
        log.error('Failed to calculate composition guides', err);
      }
    }

    // 4. Recommended camera settings based on attributes
    if (analysisResults.attributes) {
      try {
        const recommendedSettings = getRecommendedCameraSettings(analysisResults.attributes);
        if (Object.keys(recommendedSettings).length > 0) {
          log.info('Recommended camera settings', recommendedSettings);
          // Could show these as suggestions in UI
        }
      } catch (err) {
        log.error('Failed to get recommended settings', err);
      }
    }
  }, [autoAdjustCamera, faceAwareLighting, showCompositionGuides, realtimeAnalysis, nodes, storeActions]);

  /**
   * Convert base64 data URL to File for API
   */
  const dataURLtoFile = useCallback((dataurl: string, filename: string): File => {
    const arr = dataurl.split(', ');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!capturedImage) {
      setError('Please capture the scene first');
      return;
    }

    if (selectedTasks.size === 0) {
      setError('Please select at least one task');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Convert captured image to File
      const imageFile = dataURLtoFile(capturedImage'scene-capture.png');
      
      // Use 'all' if selected, otherwise use first selected task
      const task = selectedTasks.has('all') ? 'all' : Array.from(selectedTasks)[0];
      
      log.info(`Starting face analysis on scene: task=${task}`);
      
      // Optional: Use SAM 2 for better face boundaries
      let sam2FaceMask = null;
      try {
        const sam2Result = await sam2Service.segmentImage(
          imageFile,
          { points: [[0.5, 0.4]] }, // Center-top (typical face location)
          'point','small'
        );
        if (sam2Result.masks && sam2Result.masks.length > 0) {
          sam2FaceMask = sam2Result.masks[0];
          log.debug('SAM 2 face segmentation completed');
        }
      } catch (sam2Error) {
        log.warn('SAM 2 segmentation failed, continuing with FaceXFormer only', sam2Error);
      }
      
      // Using 'trained' model (latest fine-tuned version)
      const result = await faceXFormerService.analyzeFace(imageFile, task'trained');
      
      // Enhance result with SAM 2 mask if available
      if (sam2FaceMask && result.results) {
        result.results.sam2_mask = sam2FaceMask.mask;
        result.results.sam2_bbox = sam2FaceMask.bbox;
        log.debug('Face analysis enhanced with SAM 2 mask');
      }
      
      setResults(result);
      log.info('Face analysis completed', result);
      
      // Store analysis data for overlay (via context)
      setAnalysisData({
        landmarks: result.results.landmarks,
        headPose: result.results.headpose,
        compositionGuides: compositionGuides,
      });
      
      // Apply enhancements based on results
      const cameraAdjustment = autoAdjustCamera && result.results.headpose
        ? calculateCameraAdjustment(result.results.headpose)
        : undefined;
      const lightingAdjustments = faceAwareLighting && result.results.headpose && result.results.parsing
        ? calculateFaceAwareLighting({
            headpose: result.results.headpose,
            parsing: result.results.parsing,
            landmarks: result.results.landmarks,
            attributes: result.results.attributes,
          }, nodes.filter((n: any) => n.light))
        : undefined;
      
      applyEnhancements(result);
      
      // Save to history
      const snapshotId = faceAnalysisHistory.addSnapshot(
        {
          headpose: result.results.headpose,
          landmarks: result.results.landmarks,
          parsing: result.results.parsing,
          attributes: result.results.attributes,
        },
        cameraAdjustment,
        lightingAdjustments,
        compositionGuides,
        {
          cameraNode: nodes.find((n: any) => n.type === 'camera'),
          lightNodes: nodes.filter((n: any) => n.light),
        }
      );
      
      setHistoryStats(faceAnalysisHistory.getStats());
      log.info('Analysis saved to history', snapshotId);
    } catch (err: any) {
      const errorMsg = err.message || 'Face analysis failed';
      setError(errorMsg);
      log.error('Face analysis error', err);
    } finally {
      setLoading(false);
    }
  }, [capturedImage, selectedTasks, dataURLtoFile]);

  const handleDownload = useCallback((data: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${data}`;
    link.download = filename;
    link.click();
  }, []);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        <FaceIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Face Analysis
      </Typography>

      {/* Scene Capture */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Capture Current Scene
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          Analyzes the 3D model/actor currently in the scene
        </Typography>
        <Button
          variant="outlined"
          fullWidth
          onClick={captureScene}
          startIcon={<CaptureIcon />}
          sx={{ mb: 2 }}
        >
          {capturedImage ? 'Recapture Scene' : 'Capture Current Model'}
        </Button>

        {imagePreview && (
          <Box sx={{ mb: 2, textAlign: 'center' }}>
            <img
              src={imagePreview}
              alt="Captured Scene"
              style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '4px' }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Scene captured - ready for analysis
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Enhancement Settings */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Auto Enhancements
        </Typography>
        <Stack spacing={1}>
          <FormControlLabel
            control={
              <Checkbox
                checked={autoAdjustCamera}
                onChange={(e) => setAutoAdjustCamera(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Auto-Adjust Camera</Typography>
                <Typography variant="caption" color="text.secondary">
                  Match camera angle to head pose
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={faceAwareLighting}
                onChange={(e) => setFaceAwareLighting(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Face-Aware Lighting</Typography>
                <Typography variant="caption" color="text.secondary">
                  Adjust lights based on face orientation
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={showCompositionGuides}
                onChange={(e) => setShowCompositionGuides(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Composition Guides</Typography>
                <Typography variant="caption" color="text.secondary">
                  Show rule of thirds, eye line, etc.
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={realtimeAnalysis}
                onChange={(e) => setRealtimeAnalysis(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Real-time Analysis</Typography>
                <Typography variant="caption" color="text.secondary">
                  Auto-analyze on pose changes (experimental)
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={backgroundAnalysis}
                onChange={(e) => setBackgroundAnalysis(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Background Auto-Analysis</Typography>
                <Typography variant="caption" color="text.secondary">
                  Automatically analyze when camera moves
                </Typography>
              </Box>
            }
          />
          {backgroundAnalysis && (
            <Box sx={{ ml: 4, mt: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Analysis Interval: {backgroundInterval / 1000}s
              </Typography>
              <Slider
                value={backgroundInterval}
                onChange={(_, value) => setBackgroundInterval(value as number)}
                min={2000}
                max={30000}
                step={1000}
                marks={[
                  { value: 2000, label: '2s' },
                  { value: 10000, label: '10s' },
                  { value: 20000, label: '20s' },
                  { value: 30000, label: '30s' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value / 1000}s`}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Analyzes automatically when camera, model, or lights change, or after interval
              </Typography>
            </Box>
          )}
        </Stack>
      </Paper>

      {/* Task Selection */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Analysis Tasks
        </Typography>
        <Stack spacing={1}>
          {tasks.map((task) => (
            <FormControlLabel
              key={task.value}
              control={
                <Checkbox
                  checked={selectedTasks.has(task.value)}
                  onChange={() => handleTaskToggle(task.value)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">{task.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {task.description}
                  </Typography>
                </Box>
              }
            />
          ))}
        </Stack>
      </Paper>

      {/* Analyze Button */}
      <Button
        variant="contained"
        fullWidth
        onClick={handleAnalyze}
        disabled={!capturedImage || loading || selectedTasks.size === 0}
        startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
        sx={{ mb: 2 }}
      >
        {loading ? 'Analyzing Scene...' : 'Analyze Current Model'}
      </Button>

      {/* History Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Analysis History
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<UndoIcon />}
            onClick={() => {
              const snapshot = faceAnalysisHistory.undo();
              if (snapshot) {
                // Restore scene state from snapshot
                if (snapshot.cameraAdjustment) {
                  const cameraNode = nodes.find((n: any) => n.type === 'camera');
                  applyCameraAdjustment(
                    snapshot.cameraAdjustment,
                    storeActions.updateNode,
                    cameraNode?.id,
                    cameraNode
                  );
                }
                if (snapshot.lightingAdjustments) {
                  applyLightingAdjustments(
                    snapshot.lightingAdjustments,
                    storeActions.updateNode,
                    snapshot.sceneState?.lightNodes
                  );
                }
                // Restore analysis data
                setAnalysisData({
                  landmarks: snapshot.analysisResults.landmarks,
                  headPose: snapshot.analysisResults.headpose,
                  compositionGuides: snapshot.compositionGuides,
                });
                setResults({ results: snapshot.analysisResults });
                setCompositionGuides(snapshot.compositionGuides);
                setHistoryStats(faceAnalysisHistory.getStats());
                log.info('Restored from history', snapshot.id);
              }
            }}
            disabled={!historyStats.canUndo}
            fullWidth
          >
            Undo
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RedoIcon />}
            onClick={() => {
              const snapshot = faceAnalysisHistory.redo();
              if (snapshot) {
                // Restore scene state from snapshot
                if (snapshot.cameraAdjustment) {
                  const cameraNode = nodes.find((n: any) => n.type === 'camera');
                  applyCameraAdjustment(
                    snapshot.cameraAdjustment,
                    storeActions.updateNode,
                    cameraNode?.id,
                    cameraNode
                  );
                }
                if (snapshot.lightingAdjustments) {
                  applyLightingAdjustments(
                    snapshot.lightingAdjustments,
                    storeActions.updateNode,
                    snapshot.sceneState?.lightNodes
                  );
                }
                // Restore analysis data
                setAnalysisData({
                  landmarks: snapshot.analysisResults.landmarks,
                  headPose: snapshot.analysisResults.headpose,
                  compositionGuides: snapshot.compositionGuides,
                });
                setResults({ results: snapshot.analysisResults });
                setCompositionGuides(snapshot.compositionGuides);
                setHistoryStats(faceAnalysisHistory.getStats());
                log.info('Restored from history', snapshot.id);
              }
            }}
            disabled={!historyStats.canRedo}
            fullWidth
          >
            Redo
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {historyStats.totalSnapshots} analyses saved
        </Typography>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Composition Guides Display */}
      {compositionGuides && showCompositionGuides && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
          <Typography variant="subtitle2" gutterBottom>
            Composition Guides
          </Typography>
          <Stack spacing={1}>
            {compositionGuides.eyeLine && (
              <Typography variant="body2">
                Eye Line: {compositionGuides.eyeLine.toFixed(2)} (should be at ~33% from top)
              </Typography>
            )}
            {compositionGuides.faceCenter && (
              <Typography variant="body2">
                Face Center: ({compositionGuides.faceCenter.x.toFixed(2)}, {compositionGuides.faceCenter.y.toFixed(2)})
              </Typography>
            )}
            {compositionGuides.ruleOfThirds && (
              <Typography variant="body2">
                Rule of Thirds: ({compositionGuides.ruleOfThirds.x.toFixed(2)}, {compositionGuides.ruleOfThirds.y.toFixed(2)})
              </Typography>
            )}
          </Stack>
        </Paper>
      )}

      {/* Results */}
      {results && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Results
          </Typography>

          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
            {results.results.face && <Tab label="Face" />}
            {results.results.parsing && <Tab label="Parsing" />}
            {results.results.landmarks && <Tab label="Landmarks" />}
            {results.results.headpose && <Tab label="Head Pose" />}
            {results.results.attributes && <Tab label="Attributes" />}
          </Tabs>

          {/* Face Tab */}
          {results.results.face && (
            <TabPanel value={activeTab} index={0}>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <img
                  src={`data:image/png;base64,${results.results.face}`}
                  alt="Face"
                  style={{ maxWidth: '100%', borderRadius: '4px' }}
                />
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleDownload(results.results.face'face.png')}
                  sx={{ mt: 1 }}
                >
                  Download
                </Button>
              </Box>
            </TabPanel>
          )}

          {/* Parsing Tab */}
          {results.results.parsing && (
            <TabPanel value={activeTab} index={results.results.face ? 1 : 0}>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                {results.results.parsing_visualization ? (
                  <img
                    src={`data:image/png;base64,${results.results.parsing_visualization}`}
                    alt="Parsing"
                    style={{ maxWidth: '100%', borderRadius: '4px' }}
                  />
                ) : (
                  <img
                    src={`data:image/png;base64,${results.results.parsing}`}
                    alt="Parsing Mask"
                    style={{ maxWidth: '100%', borderRadius: '4px' }}
                  />
                )}
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() =>
                    handleDownload(
                      results.results.parsing_visualization || results.results.parsing'parsing.png'
                    )
                  }
                  sx={{ mt: 1 }}
                >
                  Download
                </Button>
              </Box>
            </TabPanel>
          )}

          {/* Landmarks Tab */}
          {results.results.landmarks && (
            <TabPanel
              value={activeTab}
              index={
                (results.results.face ? 1 : 0) + (results.results.parsing ? 1 : 0)
              }
            >
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                {results.results.landmarks_visualization && (
                  <img
                    src={`data:image/png;base64,${results.results.landmarks_visualization}`}
                    alt="Landmarks"
                    style={{ maxWidth: '100%', borderRadius: '4px' }}
                  />
                )}
                <Typography variant="body2" sx={{ mt: 2 }}>
                  {results.results.landmarks.length} landmarks detected
                </Typography>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() =>
                    handleDownload(
                      results.results.landmarks_visualization || results.results.face'landmarks.png'
                    )
                  }
                  sx={{ mt: 1 }}
                >
                  Download
                </Button>
              </Box>
            </TabPanel>
          )}

          {/* Head Pose Tab */}
          {results.results.headpose && (
            <TabPanel
              value={activeTab}
              index={
                (results.results.face ? 1 : 0) +
                (results.results.parsing ? 1 : 0) +
                (results.results.landmarks ? 1 : 0)
              }
            >
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                {results.results.headpose_visualization && (
                  <img
                    src={`data:image/png;base64,${results.results.headpose_visualization}`}
                    alt="Head Pose"
                    style={{ maxWidth: '100%', borderRadius: '4px' }}
                  />
                )}
                <Stack spacing={1} sx={{ mt: 2 }}>
                  <Chip
                    label={`Pitch: ${results.results.headpose.pitch?.toFixed(2)}°`}
                    color="primary"
                  />
                  <Chip
                    label={`Yaw: ${results.results.headpose.yaw?.toFixed(2)}°`}
                    color="primary"
                  />
                  <Chip
                    label={`Roll: ${results.results.headpose.roll?.toFixed(2)}°`}
                    color="primary"
                  />
                </Stack>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() =>
                    handleDownload(
                      results.results.headpose_visualization || results.results.face'headpose.png')
                  }
                  sx={{ mt: 1 }}
                >
                  Download
                </Button>
              </Box>
            </TabPanel>
          )}

          {/* Attributes Tab */}
          {results.results.attributes && (
            <TabPanel
              value={activeTab}
              index={
                (results.results.face ? 1 : 0) +
                (results.results.parsing ? 1 : 0) +
                (results.results.landmarks ? 1 : 0) +
                (results.results.headpose ? 1 : 0)
              }
            >
              <Typography variant="body2" sx={{ mb: 2 }}>
                {results.results.attributes.length} attributes detected
              </Typography>
              <Grid container spacing={1}>
                {results.results.attributes.map((attr: number, idx: number) => (
                  <Grid item key={idx}>
                    <Chip
                      label={`Attr ${idx + 1}: ${attr}`}
                      size="small"
                      color={attr === 1 ? 'primary' : 'default'}
                    />
                  </Grid>
                ))}
              </Grid>
            </TabPanel>
          )}
        </Paper>
      )}
    </Box>
  );
}


