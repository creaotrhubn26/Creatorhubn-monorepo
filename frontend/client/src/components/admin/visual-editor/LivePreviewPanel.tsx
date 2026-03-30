/**
 * Live Preview Panel - Renders actual UI from generated code
 * Supports responsive preview and device simulation
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  Typography,
  ButtonGroup,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  Slider,
  Drawer,
  Paper,
  Chip,
  List,
  ListItem,
  ListItemText,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  Visibility,
  Refresh,
  OpenInNew,
  PhoneIphone,
  Tablet,
  Computer,
  ZoomIn,
  ZoomOut,
  FitScreen,
  Code,
  ScreenRotation,
  GridOn,
  CameraAlt,
  Accessible,
  Speed as Speed,
  TouchApp,
  Close,
  FiberManualRecord,
  Straighten,
  PlaylistPlay,
} from '@mui/icons-material';
import { useVisualEditor, type EditorElement } from './VisualEditorContext';
import {
  EDITOR_DEVICE_PROFILES,
  resolveEditorBrowserViewportMetrics,
  resolveEditorDeviceProfile,
} from './visualEditorModel';
import html2canvas from 'html2canvas';
import { AccessibilityChecker } from './AccessibilityChecker';

interface LivePreviewPanelProps {
  code?: {
    html?: string;
    react?: string;
    css?: string;
    javascript?: string;
  };
  mode?: 'html' | 'react';
}

type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'custom';

interface ConsoleLog {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: number;
}

interface InteractionEvent {
  id: string;
  type: 'click' | 'hover' | 'input' | 'submit';
  target: string;
  timestamp: number;
  data?: unknown;
}

interface PreviewViewport {
  width: number;
  height: number;
  label: string;
  browserChromeTop: number;
  browserChromeBottom: number;
  safeInsetLeft: number;
  safeInsetRight: number;
}

type PreviewRecordingSession = {
  canvas: HTMLCanvasElement;
  intervalId: number;
  mediaRecorder: MediaRecorder;
  mimeType: string;
  stream: MediaStream;
};

const DEVICE_PRESETS = [
  { name: EDITOR_DEVICE_PROFILES.mobile.model, width: EDITOR_DEVICE_PROFILES.mobile.viewport.width, height: EDITOR_DEVICE_PROFILES.mobile.viewport.height },
  { name: 'iPhone 15', width: 390, height: 844 },
  { name: 'Galaxy S24', width: 360, height: 780 },
  { name: 'Pixel 8', width: 412, height: 915 },
  { name: EDITOR_DEVICE_PROFILES.tablet.model, width: EDITOR_DEVICE_PROFILES.tablet.viewport.width, height: EDITOR_DEVICE_PROFILES.tablet.viewport.height },
  { name: EDITOR_DEVICE_PROFILES.desktop.model, width: EDITOR_DEVICE_PROFILES.desktop.viewport.width, height: EDITOR_DEVICE_PROFILES.desktop.viewport.height },
  { name: 'Desktop HD', width: 1920, height: 1080 },
  { name: 'Desktop 4K', width: 3840, height: 2160 },
];

export const LivePreviewPanel: React.FC<LivePreviewPanelProps> = ({ code, mode = 'react' }) => {
  const { state } = useVisualEditor();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewSurfaceRef = useRef<HTMLDivElement>(null);
  const recordingSessionRef = useRef<PreviewRecordingSession | null>(null);
  const [device, setDevice] = useState<DeviceType>(
    state.currentBreakpoint === 'desktop' ? 'desktop' : state.currentBreakpoint,
  );
  const [zoom, setZoom] = useState(100);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    state.currentBreakpoint === 'desktop' ? 'landscape' : state.currentOrientation,
  );
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [interactions, setInteractions] = useState<InteractionEvent[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [showInteractions, setShowInteractions] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [customWidth, setCustomWidth] = useState(1024);
  const [customHeight, setCustomHeight] = useState(768);
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [viewportPreset, setViewportPreset] = useState('responsive');
  const [performanceMetrics, setPerformanceMetrics] = useState({
    loadTime: 0,
    renderTime: 0,
    fps: 60,
  });
  const [touchMode, setTouchMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<string | null>(null);

  useEffect(() => {
    renderPreview();
  }, [state.elements, device, orientation, code]);

  useEffect(() => {
    if (device !== 'custom') {
      setViewportPreset('responsive');
    }
  }, [device]);

  const getViewportForDevice = useCallback((): PreviewViewport => {
    if (device === 'custom') {
      return {
        width: customWidth,
        height: customHeight,
        label: 'Custom viewport',
        browserChromeTop: 0,
        browserChromeBottom: 0,
        safeInsetLeft: 0,
        safeInsetRight: 0,
      };
    }

    const breakpoint = device === 'desktop' ? 'desktop' : device;
    const resolvedOrientation = breakpoint === 'desktop' ? 'landscape' : orientation;
    const deviceProfile = resolveEditorDeviceProfile(breakpoint, resolvedOrientation);
    const browserViewport = resolveEditorBrowserViewportMetrics(breakpoint, resolvedOrientation);

    return {
      width: browserViewport.contentWidth,
      height: browserViewport.contentHeight,
      label: `${deviceProfile.model} web viewport`,
      browserChromeTop: browserViewport.topBarHeight,
      browserChromeBottom: browserViewport.bottomBarHeight,
      safeInsetLeft: browserViewport.contentInsetLeft,
      safeInsetRight: browserViewport.contentInsetRight,
    };
  }, [customHeight, customWidth, device, orientation]);

  const renderPreview = () => {
    if (!iframeRef.current) return;

    const startTime = performance.now();
    setIsRefreshing(true);
    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc) return;

    const htmlContent = generatePreviewHTML();

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Inject console capture
    if (iframe.contentWindow) {
      const win = iframe.contentWindow as Window & typeof globalThis;
      const originalConsole = {
        log: win.console.log,
        warn: win.console.warn,
        error: win.console.error,
        info: win.console.info,
      };

      win.console.log = (...args: unknown[]) => {
        originalConsole.log.apply(win.console, args);
        addConsoleLog('log', args.join(' '));
      };

      win.console.warn = (...args: unknown[]) => {
        originalConsole.warn.apply(win.console, args);
        addConsoleLog('warn', args.join(' '));
      };

      win.console.error = (...args: unknown[]) => {
        originalConsole.error.apply(win.console, args);
        addConsoleLog('error', args.join(' '));
        setErrors((prev) => [...prev, args.join('')]);
      };

      win.console.info = (...args: unknown[]) => {
        originalConsole.info.apply(win.console, args);
        addConsoleLog('info', args.join(' '));
      };

      // Track interactions
      win.document.addEventListener('click', (e: Event) => {
        const target = e.target;
        if (target instanceof HTMLElement) {
          addInteraction('click', target.tagName, e);
        }
      });

      win.document.addEventListener('input', (e: Event) => {
        const target = e.target;
        if (target instanceof HTMLElement) {
          addInteraction('input', target.tagName, e);
        }
      });
    }

    const renderTime = performance.now() - startTime;
    setPerformanceMetrics((prev) => ({ ...prev, renderTime, loadTime: renderTime }));
    setTimeout(() => setIsRefreshing(false), 300);
  };

  const addConsoleLog = (type: ConsoleLog['type'], message: string) => {
    const log: ConsoleLog = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: Date.now(),
    };
    setConsoleLogs((prev) => [...prev, log].slice(-100)); // Keep last 100 logs
  };

  const addInteraction = (type: InteractionEvent['type'], target: string, data?: unknown) => {
    const interaction: InteractionEvent = {
      id: Date.now().toString(),
      type,
      target,
      timestamp: Date.now(),
      data,
    };
    setInteractions((prev) => [...prev, interaction].slice(-50)); // Keep last 50 interactions
  };

  const generatePreviewHTML = () => {
    const cssContent = [generateCSS(), code?.css ?? ''].filter(Boolean).join('\n');
    const jsContent = [generateJS(), code?.javascript ?? ''].filter(Boolean).join('\n');
    const bodyContent = generateBody();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Preview</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #ffffff;
      overflow: auto;
      ${touchMode ? 'touch-action: manipulation; -webkit-tap-highlight-color: rgba(0, 122, 204, 0.18);' : ''}
    }
    
    .preview-container {
      position: relative;
      width: 100%;
      min-height: 100vh;
      ${
        showGrid
          ? `
        background-image: linear-gradient(rgba(0,0,0,.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,.05) 1px, transparent 1px);
        background-size: 20px 20px;
      `
          : ''
      }
    }
    
    ${cssContent}
    
    /* Element styles */
    .element {
      position: absolute;
      cursor: pointer;
      transition: box-shadow 0.2s;
    }
    
    .element:hover {
      box-shadow: 0 0 0 2px #007ACC;
    }
    
    .button-element {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #007ACC;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      padding: 8px 16px;
    }
    
    .button-element:hover {
      background: #005A9E;
    }
    
    .text-element {
      display: flex;
      align-items: center;
      color: #333;
      font-size: 14px;
      line-height: 1.5;
    }
    
    .container-element {
      border: 1px dashed #ccc;
      background: rgba(0,0,0,0.02);
    }
    
    .image-element {
      object-fit: cover;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="preview-container">
    ${bodyContent}
  </div>
  <script>
    ${jsContent}
    
    // Console capture for debugging
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn
    };
    
    window.addEventListener('error', (e) => {
      console.error('Preview Error: ', e.message);
    });
    
    // Element interaction tracking
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('element')) {
        console.log('Element clicked:', target.id);
      }
    });
  </script>
</body>
</html>
    `;
  };

  const generateBody = () => {
    if (state.elements.length === 0) {
      return `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: #999; font-size: 16px;">
          <div style="text-align: center;">
            <p>No elements on canvas</p>
            <p style="font-size: 14px; margin-top: 8px;">Drag components to start building</p>
          </div>
        </div>
      `;
    }

    let html = '';
    state.elements.forEach((element) => {
      html += generateElementHTML(element);
    });
    return html;
  };

  const generateElementHTML = (element: EditorElement): string => {
    const baseStyle = `
      left: ${element.x}px;
      top: ${element.y}px;
      width: ${element.width}px;
      height: ${element.height}px;
    `;

    const additionalStyles = Object.entries(element.styles || {})
      .map(([key, value]) => {
        // Convert camelCase to kebab-case
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${cssKey}: ${value};`;
      })
      .join(' ');

    const style = `${baseStyle} ${additionalStyles}`;

    switch (element.type) {
      case 'button':
        return `<button class="element button-element" id="${element.id}" style="${style}">${element.props.text || 'Button'}</button>\n`;

      case 'text':
        return `<div class="element text-element" id="${element.id}" style="${style}">${element.props.text || 'Text'}</div>\n`;

      case 'container':
        return `<div class="element container-element" id="${element.id}" style="${style}"></div>\n`;

      case 'image': {
        const src = element.props.src || 'https://via.placeholder.com/300x200?text=Image';
        const alt = element.props.alt || 'Image';
        return `<img class="element image-element" id="${element.id}" src="${src}" alt="${alt}" style="${style}" />\n`;
      }

      default:
        return `<div class="element" id="${element.id}" style="${style}"></div>\n`;
    }
  };

  const generateCSS = () => {
    let css = '';
    state.elements.forEach((element) => {
      if (element.styles && Object.keys(element.styles).length > 0) {
        css += `#${element.id} {\n`;
        Object.entries(element.styles).forEach(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          css += `  ${cssKey}: ${value};\n`;
        });
        css += `}\n\n`;
      }
    });
    return css;
  };

  const generateJS = () => {
    let js = '';
    state.elements.forEach((element) => {
      if (element.type === 'button') {
        js += `
document.getElementById('${element.id}')?.addEventListener('click', function(e) {
  console.log('Button clicked: ${element.id}');
  // Add custom interactions here
});
        `;
      }
    });
    return js;
  };

  const handleRefresh = () => {
    renderPreview();
  };

  const handleOpenInNewTab = () => {
    const htmlContent = generatePreviewHTML();
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 10, 50));
  };

  const handleFitScreen = () => {
    setZoom(100);
  };

  const handleZoomSlider = (_: Event, value: number | number[]) => {
    const nextZoom = Array.isArray(value) ? value[0] : value;
    setZoom(nextZoom);
  };

  const handleRotate = () => {
    setOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'));
  };

  const handleScreenshot = async () => {
    if (!previewSurfaceRef.current) return;

    try {
      const canvas = await html2canvas(previewSurfaceRef.current, {
        backgroundColor: '#ffffff',
        scale: 1,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `preview-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Screenshot error:', error);
    }
  };

  const stopPreviewRecording = useCallback(() => {
    const session = recordingSessionRef.current;
    if (!session) {
      return;
    }

    if (session.mediaRecorder.state !== 'inactive') {
      session.mediaRecorder.stop();
    } else {
      window.clearInterval(session.intervalId);
      session.stream.getTracks().forEach((track) => track.stop());
      recordingSessionRef.current = null;
      setIsRecording(false);
    }
  }, []);

  const dimensions = getViewportForDevice();
  const scaledWidth = (dimensions.width * zoom) / 100;
  const scaledHeight = (dimensions.height * zoom) / 100;

  const captureRecordingFrame = useCallback(async (targetCanvas: HTMLCanvasElement) => {
    const iframeDocument = iframeRef.current?.contentDocument;
    const sourceNode = iframeDocument?.documentElement ?? previewSurfaceRef.current;

    if (!sourceNode) {
      throw new Error('Preview surface is not ready for recording');
    }

    const frame = await html2canvas(sourceNode as HTMLElement, {
      backgroundColor: '#ffffff',
      scale: 1,
      useCORS: true,
      width: dimensions.width,
      height: dimensions.height,
      windowWidth: dimensions.width,
      windowHeight: dimensions.height,
    });

    targetCanvas.width = dimensions.width;
    targetCanvas.height = dimensions.height;
    const context = targetCanvas.getContext('2d');
    if (!context) {
      throw new Error('Could not create video recording context');
    }

    context.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    context.drawImage(frame, 0, 0, targetCanvas.width, targetCanvas.height);
  }, [dimensions.height, dimensions.width]);

  const handleVideoRecord = useCallback(async () => {
    if (isRecording) {
      stopPreviewRecording();
      return;
    }

    if (!previewSurfaceRef.current || typeof MediaRecorder === 'undefined') {
      setRecordingStatus('Video recording is not supported in this browser');
      return;
    }

    const canvas = document.createElement('canvas');

    try {
      await captureRecordingFrame(canvas);
      const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
        .find((candidate) => MediaRecorder.isTypeSupported(candidate))
        ?? 'video/webm';
      const stream = canvas.captureStream(6);
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      let frameInFlight = false;

      const intervalId = window.setInterval(() => {
        if (frameInFlight) {
          return;
        }

        frameInFlight = true;
        void captureRecordingFrame(canvas)
          .catch((error: unknown) => {
            setRecordingStatus(error instanceof Error ? error.message : 'Preview capture failed during recording');
          })
          .finally(() => {
            frameInFlight = false;
          });
      }, 300);

      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      });

      mediaRecorder.addEventListener('stop', () => {
        window.clearInterval(intervalId);
        stream.getTracks().forEach((track) => track.stop());
        recordingSessionRef.current = null;
        setIsRecording(false);

        if (chunks.length === 0) {
          setRecordingStatus('Preview recording ended without captured frames');
          return;
        }

        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const fileName = `preview-recording-${Date.now()}.webm`;
        const link = document.createElement('a');
        link.download = fileName;
        link.href = url;
        link.click();
        setRecordingStatus(`Saved ${fileName}`);
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      });

      recordingSessionRef.current = {
        canvas,
        intervalId,
        mediaRecorder,
        mimeType,
        stream,
      };

      mediaRecorder.start(750);
      setRecordingStatus('Recording preview to WebM');
      setIsRecording(true);
    } catch (error) {
      setRecordingStatus(error instanceof Error ? error.message : 'Could not start preview recording');
    }
  }, [captureRecordingFrame, isRecording, stopPreviewRecording]);

  const handleAccessibilityCheck = () => {
    setShowAccessibility(!showAccessibility);
  };

  const handleCustomViewport = () => {
    setShowCustomDialog(true);
  };

  const applyCustomViewport = () => {
    setDevice('custom');
    setViewportPreset(`${customWidth}x${customHeight}`);
    setShowCustomDialog(false);
  };

  const handleViewportPresetChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setViewportPreset(value);

    if (value === 'responsive') {
      if (device === 'custom') {
        setDevice(state.currentBreakpoint === 'desktop' ? 'desktop' : state.currentBreakpoint);
      }
      return;
    }

    if (value === 'custom') {
      handleCustomViewport();
      return;
    }

    const preset = DEVICE_PRESETS.find((entry) => entry.name === value);
    if (!preset) {
      return;
    }

    setCustomWidth(preset.width);
    setCustomHeight(preset.height);
    setDevice('custom');
  };

  const horizontalRulerMarks = Array.from({ length: Math.max(2, Math.ceil(dimensions.width / 160)) }, (_, index) =>
    Math.min(dimensions.width, index * 160),
  );
  const verticalRulerMarks = Array.from({ length: Math.max(2, Math.ceil(dimensions.height / 160)) }, (_, index) =>
    Math.min(dimensions.height, index * 160),
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#F5F5F5' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1,
          bgcolor: 'white',
          borderBottom: '1px solid #E0E0E0'
        }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Visibility sx={{ color: '#007ACC', fontSize: 20 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Live Preview
          </Typography>
          <Chip size="small" color="primary" variant="outlined" label={`${mode.toUpperCase()} source`} />
          <Chip size="small" variant="outlined" label={`${dimensions.width} × ${dimensions.height}`} />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Device Selector */}
          <ToggleButtonGroup
            value={device}
            exclusive
            onChange={(_, newDevice: DeviceType | null) => {
              if (!newDevice) {
                return;
              }

              setViewportPreset('responsive');
              setDevice(newDevice);
            }}
            size="small"
          >
            <ToggleButton value="mobile">
              <Tooltip title="Mobile">
                <PhoneIphone fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="tablet">
              <Tooltip title="Tablet">
                <Tablet fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="desktop">
              <Tooltip title="Desktop">
                <Computer fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          <Select
            value={viewportPreset}
            size="small"
            onChange={handleViewportPresetChange}
            displayEmpty
            sx={{ minWidth: 180 }}
            inputProps={{ 'aria-label': 'Viewport preset' }}
          >
            <MenuItem value="responsive">Responsive viewport</MenuItem>
            <MenuItem value="custom">Custom viewport…</MenuItem>
            {DEVICE_PRESETS.map((preset) => (
              <MenuItem key={preset.name} value={preset.name}>
                {preset.name} ({preset.width} × {preset.height})
              </MenuItem>
            ))}
          </Select>

          <Divider orientation="vertical" flexItem />

          {/* Zoom Controls */}
          <ButtonGroup size="small" aria-label="Zoom controls">
            <Tooltip title="Zoom Out">
              <IconButton onClick={handleZoomOut} size="small">
                <ZoomOut fontSize="small" />
              </IconButton>
            </Tooltip>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 1,
                minWidth: 60,
                justifyContent: 'center'
              }}>
              <Typography variant="caption">{zoom}%</Typography>
            </Box>
            <Tooltip title="Zoom In">
              <IconButton onClick={handleZoomIn} size="small">
                <ZoomIn fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fit Screen">
              <IconButton onClick={handleFitScreen} size="small">
                <FitScreen fontSize="small" />
              </IconButton>
            </Tooltip>
          </ButtonGroup>
          <Box sx={{ width: 120, px: 1 }}>
            <Slider
              value={zoom}
              min={50}
              max={200}
              step={10}
              onChange={handleZoomSlider}
              size="small"
              aria-label="Preview zoom"
            />
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Actions */}
          <ButtonGroup size="small">
            <Tooltip title="Rotate">
              <IconButton onClick={handleRotate} size="small" disabled={device === 'desktop'}>
                <ScreenRotation fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Grid">
              <IconButton
                onClick={() => setShowGrid(!showGrid)}
                size="small"
                color={showGrid ? 'primary' : 'default'}
              >
                <GridOn fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Rulers">
              <IconButton
                onClick={() => setShowRulers(!showRulers)}
                size="small"
                color={showRulers ? 'primary' : 'default'}
              >
                <Straighten fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Screenshot">
              <IconButton onClick={handleScreenshot} size="small">
                <CameraAlt fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={isRecording ? 'Stop recording' : 'Record preview'}>
              <IconButton onClick={() => void handleVideoRecord()} size="small" color={isRecording ? 'error' : 'default'}>
                <FiberManualRecord fontSize="small" />
              </IconButton>
            </Tooltip>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem />

          <ButtonGroup size="small">
            <Tooltip title="Console">
              <IconButton
                onClick={() => setShowConsole(!showConsole)}
                size="small"
                color={showConsole ? 'primary' : 'default'}
              >
                <Code fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Accessibility">
              <IconButton
                onClick={handleAccessibilityCheck}
                size="small"
                color={showAccessibility ? 'primary' : 'default'}
              >
                <Accessible fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Performance">
              <IconButton
                onClick={() => setShowPerformance(!showPerformance)}
                size="small"
                color={showPerformance ? 'primary' : 'default'}
              >
                <Speed fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Touch Mode">
              <IconButton
                onClick={() => setTouchMode(!touchMode)}
                size="small"
                color={touchMode ? 'primary' : 'default'}
              >
                <TouchApp fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Interaction log">
              <IconButton
                onClick={() => setShowInteractions(!showInteractions)}
                size="small"
                color={showInteractions ? 'primary' : 'default'}
              >
                <PlaylistPlay fontSize="small" />
              </IconButton>
            </Tooltip>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem />

          <ButtonGroup size="small">
            <Tooltip title="Refresh Preview">
              <IconButton onClick={handleRefresh} size="small" disabled={isRefreshing}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Open in New Tab">
              <IconButton onClick={handleOpenInNewTab} size="small">
                <OpenInNew fontSize="small" />
              </IconButton>
            </Tooltip>
          </ButtonGroup>
        </Box>
      </Box>

      {/* Device Info Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          py: 0.75,
          bgcolor: '#FAFAFA',
          borderBottom: '1px solid #E0E0E0',
          fontSize: '0.75rem'
        }}>
        <Typography variant="caption" color="text.secondary">
          {dimensions.label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {dimensions.width} × {dimensions.height}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Chrome {dimensions.browserChromeTop}px / {dimensions.browserChromeBottom}px
        </Typography>
        {(dimensions.safeInsetLeft > 0 || dimensions.safeInsetRight > 0) && (
          <Typography variant="caption" color="text.secondary">
            Safe sides {dimensions.safeInsetLeft}px / {dimensions.safeInsetRight}px
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          {state.elements.length} element{state.elements.length !== 1 ? 's' : ', '}
        </Typography>
        {touchMode && (
          <Typography variant="caption" color="text.secondary">
            Touch gestures simulated
          </Typography>
        )}
      </Box>

      {/* Preview Area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          p: 3,
          bgcolor: '#E0E0E0',
          position: 'relative',
        }}
      >
        {recordingStatus && (
          <Alert
            severity={isRecording ? 'info' : errors.length > 0 ? 'warning' : 'success'}
            sx={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 5 }}
          >
            {recordingStatus}
          </Alert>
        )}
        {errors.length > 0 && (
          <Alert severity="error" sx={{ position: 'absolute', top: recordingStatus ? 68 : 12, left: 12, right: 12, zIndex: 5 }}>
            Preview reported {errors.length} runtime error{errors.length !== 1 ? 's' : ''}. Open Console to inspect details.
          </Alert>
        )}
        <Box
          ref={previewSurfaceRef}
          sx={{
            width: scaledWidth,
            height: scaledHeight,
            bgcolor: 'white',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            borderRadius: 2,
            overflow: 'hidden',
            position: 'relative',
            transition: 'all 0.3s ease'
          }}>
          {showRulers && (
            <>
              <Box
                data-testid="preview-ruler-horizontal"
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 24,
                  zIndex: 4,
                  bgcolor: 'rgba(26, 26, 26, 0.72)',
                  color: 'white',
                  pointerEvents: 'none',
                }}
              >
                {horizontalRulerMarks.map((mark) => (
                  <Box
                    key={`h-${mark}`}
                    sx={{
                      position: 'absolute',
                      left: `${(mark * zoom) / 100}px`,
                      top: 0,
                      bottom: 0,
                      width: 1,
                      bgcolor: 'rgba(255,255,255,0.32)',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ position: 'absolute', top: 4, left: 4, fontSize: '0.62rem', color: 'white' }}
                    >
                      {mark}px
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box
                data-testid="preview-ruler-vertical"
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: 24,
                  zIndex: 4,
                  bgcolor: 'rgba(26, 26, 26, 0.72)',
                  color: 'white',
                  pointerEvents: 'none',
                }}
              >
                {verticalRulerMarks.map((mark) => (
                  <Box
                    key={`v-${mark}`}
                    sx={{
                      position: 'absolute',
                      top: `${(mark * zoom) / 100}px`,
                      left: 0,
                      right: 0,
                      height: 1,
                      bgcolor: 'rgba(255,255,255,0.32)',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ position: 'absolute', top: 2, left: 2, fontSize: '0.62rem', color: 'white' }}
                    >
                      {mark}px
                    </Typography>
                  </Box>
                ))}
              </Box>
            </>
          )}
          <iframe
            ref={iframeRef}
            title="Live Preview"
            style={{
              width: dimensions.width,
              height: dimensions.height,
              border: 'none',
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top left',
              background: 'white'
            }}
          />

          {isRefreshing && (
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
                bgcolor: 'rgba(255,255,255,0.8)',
                zIndex: 99
              }}>
              <Typography variant="body2" color="text.secondary">
                Refreshing preview...
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Console Drawer */}
      <Drawer
        anchor="bottom"
        open={showConsole}
        onClose={() => setShowConsole(false)}
        variant="persistent"
        PaperProps={{ sx: { height: '40%', bgcolor: '#1E1E1E' } }}

      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1,
            bgcolor: '#252526',
            borderBottom: '1px solid #3E3E42'
          }}>
          <Typography variant="body2" sx={{ color: '#CCCCCC', fontWeight: 600 }}>
            Console
          </Typography>
          <Box>
            <IconButton size="small" onClick={() => setConsoleLogs([])} sx={{ color: '#CCCCCC' }}>
              <Close fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
          {consoleLogs.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#969696', p: 2 }}>
              No console output
            </Typography>
          ) : (
            consoleLogs.map((log) => (
              <Box key={log.id} sx={{ mb: 0.5, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                <Chip
                  label={log.type}
                  size="small"
                  sx={{
                    mr: 1,
                    bgcolor: log.type === 'error'
                          ? '#f44336'
                        : log.type === 'warn'
                          ? '#ff9800'
                          : '#4caf50',
                    color: 'white',
                    height: 18,
                    fontSize: '0.7rem'
                  }} />
                <Typography component="span" sx={{ color: '#D4D4D4' }}>
                  {log.message}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      </Drawer>

      <Drawer
        anchor="right"
        open={showInteractions}
        onClose={() => setShowInteractions(false)}
        PaperProps={{ sx: { width: 320 } }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1.5,
            borderBottom: '1px solid #E0E0E0',
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Interaction Log
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Recent click and input events from the preview frame
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setShowInteractions(false)}>
            <Close fontSize="small" />
          </IconButton>
        </Box>

        <List dense sx={{ flex: 1, overflowY: 'auto' }}>
          {interactions.length === 0 ? (
            <ListItem>
              <ListItemText
                primary="No interactions captured yet"
                secondary="Interact with the preview to populate this panel."
              />
            </ListItem>
          ) : (
            interactions
              .slice()
              .reverse()
              .map((interaction) => (
                <ListItem key={interaction.id} divider>
                  <ListItemText
                    primary={`${interaction.type.toUpperCase()} • ${interaction.target}`}
                    secondary={new Date(interaction.timestamp).toLocaleTimeString()}
                  />
                </ListItem>
              ))
          )}
        </List>
      </Drawer>

      {/* Performance Panel */}
      {showPerformance && (
        <Paper
          sx={{
            position: 'absolute',
            top: 60,
            right: 10,
            width: 250,
            bgcolor: 'white',
            boxShadow: 3,
            zIndex: 100,
            p: 2
          }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Performance Metrics
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Load Time: {performanceMetrics.loadTime.toFixed(2)}ms
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Render Time: {performanceMetrics.renderTime.toFixed(2)}ms
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Interaction Events: {interactions.length}
          </Typography>
          <Typography variant="body2">FPS: {performanceMetrics.fps}</Typography>
        </Paper>
      )}

      {/* Accessibility Checker */}
      <AccessibilityChecker
        open={showAccessibility}
        onClose={() => setShowAccessibility(false)}
        iframeRef={iframeRef}
      />

      {/* Custom Viewport Dialog */}
      <Dialog open={showCustomDialog} onClose={() => setShowCustomDialog(false)}>
        <DialogTitle>Custom Viewport</DialogTitle>
        <DialogContent>
          <TextField
            label="Width"
            type="number"
            value={customWidth}
            onChange={(e) => setCustomWidth(Number(e.target.value))}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Height"
            type="number"
            value={customHeight}
            onChange={(e) => setCustomHeight(Number(e.target.value))}
            fullWidth
            margin="normal"
          />
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Device Presets: </Typography>
            {DEVICE_PRESETS.map((preset) => (
              <Chip
                key={preset.name}
                label={preset.name}
                size="small"
                onClick={() => {
                  setCustomWidth(preset.width);
                  setCustomHeight(preset.height);
                }}
                sx={{ m: 0.5 }} />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCustomDialog(false)}>Cancel</Button>
          <Button onClick={applyCustomViewport} variant="contained">
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 0.5,
          bgcolor: '#007ACC',
          color: 'white',
          fontSize: '0.75rem'
        }}>
        <Typography variant="caption" sx={{ color: 'white' }}>
          Ready • {device.toUpperCase()} • {orientation.toUpperCase()} • {dimensions.label}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {errors.length > 0 && (
            <Typography variant="caption" sx={{ color: '#ff6b6b' }}>
              {errors.length} error{errors.length !== 1 ? 's' : ''}
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: 'white' }}>
            {consoleLogs.length} logs • {interactions.length} interactions
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
