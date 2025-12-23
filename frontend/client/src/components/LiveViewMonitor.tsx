/**
 * Live View Monitor
 *
 * Main component integrating: * - Live camera feed
 * - WebGL overlays (focus peaking, zebra stripes, false color)
 * - AI Director analysis panel
 * - Waveform and histogram monitors
 * - Dynamic framing guides
 * - Shot metadata overlay
 * - Real-time WebSocket communication
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AIDirectorPanel, DirectorAnalysis } from './AIDirectorPanel';
import {
  WaveformMonitor,
  HistogramDisplay,
  WaveformData,
  HistogramData,
} from './WaveformHistogram';
import {
  DynamicFramingGuides,
  ShotMetadataOverlay,
  AlertOverlay,
  PoseCueOverlay,
  SubjectDetection,
  SafeAreas,
  ShotMetadata,
  Alert,
  PoseCue,
} from './LiveViewOverlays';

interface LiveViewMonitorProps {
  cameraIp: string;
  projectName?: string;
  sceneName?: string;
  autoStart?: boolean;
}

interface VisionAgentData {
  focus: {
    score: number;
    areas: Array<{ x: number; y: number; width: number; height: number; sharpness: number }>;
    peakDetected: boolean;
    subjectInFocus: boolean;
  };
  exposure: {
    overall: string;
    histogram: number[];
    clippedHighlights: unknown[];
    blockedShadows: unknown[];
    zebraThreshold: number;
    falseColorMap: unknown[];
  };
  waveform: {
    data: number[][];
    peakWhite: number;
    blackLevel: number;
    averageLevel: number;
  };
  subject: SubjectDetection;
  safeAreas: SafeAreas;
  alerts: Alert[];
  metadata: {
    frameWidth: number;
    frameHeight: number;
    timestamp: string;
  };
}

export const LiveViewMonitor: React.FC<LiveViewMonitorProps> = ({
  cameraIp,
  projectName,
  sceneName,
  autoStart = true,
}) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isLiveViewActive, setIsLiveViewActive] = useState(false);
  const [directorAnalysis, setDirectorAnalysis] = useState<DirectorAnalysis | null>(null);
  const [visionData, setVisionData] = useState<VisionAgentData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [poseCues, setPoseCues] = useState<PoseCue[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // WebGL overlays config
  const [overlayConfig, setOverlayConfig] = useState({
    focusPeaking: { enabled: true, color: 'green' as const, threshold: 0.3, opacity: 0.7 },
    zebraStripes: {
      enabled: true,
      threshold: 235,
      color: 'red' as const,
      animationSpeed: 1.0,
      opacity: 0.5 },
    falseColor: { enabled: false, mode: 'standard' as const, opacity: 0.6 },
  });

  // UI visibility toggles
  const [showFramingGuides, setShowFramingGuides] = useState(true);
  const [showWaveform, setShowWaveform] = useState(true);
  const [showHistogram, setShowHistogram] = useState(true);
  const [showMetadata, setShowMetadata] = useState(true);
  const [showDirectorPanel, setShowDirectorPanel] = useState(true);

  // Waveform/Histogram data
  const [waveformData, setWaveformData] = useState<WaveformData>({
    data: [],
    peakWhite: 255,
    blackLevel: 0,
    averageLevel: 128,
  });

  const [histogramData, setHistogramData] = useState<HistogramData>({
    histogram: new Array(256).fill(0),
    clippedHighlights: 0,
    blockedShadows: 0,
    averageLevel: 128,
  });

  // Shot metadata
  const [shotMetadata, setShotMetadata] = useState<ShotMetadata>({
    projectName,
    sceneName,
    cameraLabel: `Camera ${cameraIp}`,
    recordingStatus: 'idle',
    cameraSettings: {
      iso: 400,
      aperture: '2.8',
      shutterSpeed: '1/125',
      whiteBalance: 5500,
    },
    timestamp: new Date().toLocaleTimeString(),
  });

  /**
   * Initialize WebSocket connection
   */
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`ws://${window.location.host}/ws/ai-director`);

    ws.onopen = () => {
      console.log('[LiveViewMonitor] WebSocket connected ');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('[LiveViewMonitor] Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('[LiveViewMonitor] WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('[LiveViewMonitor] WebSocket error: ', error);
    };

    wsRef.current = ws;
  }, []);

  /**
   * Handle incoming WebSocket messages
   */
  const handleWebSocketMessage = (message: unknown) => {
    switch (message.type) {
      case 'director_analysis': setDirectorAnalysis(message.analysis);
        setIsAnalyzing(false);
        break;

      case 'vision_data': setVisionData(message.data);

        // Update waveform data
        if (message.data.waveform) {
          setWaveformData({
            data: message.data.waveform.data,
            peakWhite: message.data.waveform.peakWhite,
            blackLevel: message.data.waveform.blackLevel,
            averageLevel: message.data.waveform.averageLevel,
          });
        }

        // Update histogram data
        if (message.data.exposure) {
          setHistogramData({
            histogram: message.data.exposure.histogram,
            clippedHighlights: message.data.exposure.clippedHighlights.length,
            blockedShadows: message.data.exposure.blockedShadows.length,
            averageLevel: message.data.waveform?.averageLevel || 128,
          });
        }
        break;

      case 'alert': setAlerts((prev) => [...message.data, ...prev].slice(0, 5));
        break;

      case 'status': console.log('[LiveViewMonitor] Status:', message.data);
        break;

      case 'pong': // Heartbeat response
        break;

      case 'error': console.error('[LiveViewMonitor] Server error:', message.error);
        break;
    }
  };

  /**
   * Start live view and frame streaming
   */
  const startLiveView = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      // Get video stream from camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1920,
          height: 1080,
        },
      });

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setIsLiveViewActive(true);
      setShotMetadata((prev) => ({ ...prev, recordingStatus: 'idle' }));

      // Start frame streaming
      startFrameStreaming();
    } catch (error) {
      console.error('[LiveViewMonitor] Error starting live view:', error);
    }
  }, []);

  /**
   * Stop live view
   */
  const stopLiveView = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop();
      videoRef.current.srcObject = null;
    }

    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    setIsLiveViewActive(false);
    setShotMetadata((prev) => ({ ...prev, recordingStatus: 'idle' }));
  }, []);

  /**
   * Start streaming frames to WebSocket
   */
  const startFrameStreaming = () => {
    if (!videoRef.current || !canvasRef.current || !wsRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;

    // Send frames at 30fps
    frameIntervalRef.current = setInterval(() => {
      if (
        wsRef.current?.readyState === WebSocket.OPEN &&
        video.readyState === video.HAVE_ENOUGH_DATA
      ) {
        // Draw current frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get frame as base64
        const frameData = canvas.toDataURL('image/jpeg', 0.8);

        // Send to WebSocket
        wsRef.current.send(
          JSON.stringify({
            type: 'frame',
            frameData,
            frameWidth: canvas.width,
            frameHeight: canvas.height,
            shotContext: {
              projectName,
              sceneName,
              timestamp: Date.now(),
            },
          }),
        );

        // Update timestamp
        setShotMetadata((prev) => ({
          ...prev,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    }, 1000 / 30); // 30fps
  };

  /**
   * Start/Stop live coaching
   */
  const handleStartCoaching = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start_director' }));
      setIsAnalyzing(true);
    }
  }, []);

  const handleStopCoaching = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_director' }));
      setIsAnalyzing(false);
    }
  }, []);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    connectWebSocket();

    if (autoStart) {
      startLiveView();
    }

    return () => {
      stopLiveView();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket, autoStart, startLiveView, stopLiveView]);

  /**
   * Heartbeat ping
   */
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' });
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.container}>
      {/* Main Live View Area */}
      <div style={styles.liveViewContainer}>
        <div style={styles.videoWrapper}>
          {/* Video element (hidden, used for capture) */}}
          <video ref={videoRef} style={{ display: 'none' } autoPlay muted />

          {/* Canvas for display and processing */}
          <canvas ref={canvasRef} style={styles.canvas} />

          {/* Overlays */}
          {visionData && showFramingGuides && (
            <DynamicFramingGuides
              subject={visionData.subject}
              safeAreas={visionData.safeAreas}
              frameWidth={visionData.metadata.frameWidth}
              frameHeight={visionData.metadata.frameHeight}
            />
          )}

          {poseCues.length > 0 && (
            <PoseCueOverlay
              cues={poseCues}
              frameWidth={visionData?.metadata.frameWidth || 1920}
              frameHeight={visionData?.metadata.frameHeight || 1080}
            />
          )}

          {showMetadata && <ShotMetadataOverlay metadata={shotMetadata} position="top-left" />}

          {alerts.length > 0 && <AlertOverlay alerts={alerts} maxVisible={3} />}
        </div>

        {/* Controls */}
        <div style={styles.controls}>
          <button style={styles.button} onClick={isLiveViewActive ? stopLiveView : startLiveView}>
            {isLiveViewActive ? '⏹ Stop' : '▶️ Start'} Live View
          </button>

          <button style={styles.button} onClick={() => setShowFramingGuides(!showFramingGuides)}>
            {showFramingGuides ? '🔲' : '⬜'} Guides
          </button>

          <button
            style={styles.button}
            onClick={() =>
              setOverlayConfig((prev) => ({
                ...prev,
                focusPeaking: { ...prev.focusPeaking, enabled: !prev.focusPeaking.enabled },
              }))
            }}
          >
            {overlayConfig.focusPeaking.enabled ? '🟢' : '⚪'} Focus
          </button>

          <button
            style={styles.button}
            onClick={() =>
              setOverlayConfig((prev) => ({
                ...prev,
                zebraStripes: { ...prev.zebraStripes, enabled: !prev.zebraStripes.enabled },
              }))
            }}
          >
            {overlayConfig.zebraStripes.enabled ? '▓▓' : '░░'} Zebras
          </button>

          <button
            style={styles.button}
            onClick={() =>
              setOverlayConfig((prev) => ({
                ...prev,
                falseColor: { ...prev.falseColor, enabled: !prev.falseColor.enabled },
              }))
            }}
          >
            {overlayConfig.falseColor.enabled ? '🌈' : '⚫'} False Color
          </button>
        </div>
      </div>

      {/* Right Panel - AI Director */}
      {showDirectorPanel && (
        <div style={styles.rightPanel}>
          <AIDirectorPanel
            analysis={directorAnalysis}
            isAnalyzing={isAnalyzing}
            onStartCoaching={handleStartCoaching}
            onStopCoaching={handleStopCoaching}
            isCoachingActive={isAnalyzing}
          />
        </div>
      )}

      {/* Bottom Panel - Waveform & Histogram */}
      <div style={styles.bottomPanel}>
        {showWaveform && <WaveformMonitor data={waveformData} width={512} height={200} />}
        {showHistogram && <HistogramDisplay data={histogramData} width={512} height={200} />}
      </div>

      {/* Connection Status */}
      <div
        style={{
          ...styles.statusIndicator,
          backgroundColor: isConnected ? '#00ff00' : '#ff0000'}}>
        {isConnected ? '● CONNECTED' : '○ DISCONNECTED'}
      </div>
    </div>
  );
};

// ==================== STYLES ====================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
    fontFamily: 'monospace',
    overflow: 'hidden',
  },
  liveViewContainer: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: '16px',
    gap: '16px',
  },
  videoWrapper: {
    position: 'relative',
    flex: 1,
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '2px solid #333',
  },
  canvas: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  controls: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    border: '1px solid #333',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#333',
    color: '#fff',
    border: '1px solid #555',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: 'monospace',
    transition: 'all 0.2s',
  },
  rightPanel: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '500px',
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto',
  },
  bottomPanel: {
    display: 'flex',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#0a0a0a',
    borderTop: '1px solid #333',
  },
  statusIndicator: {
    position: 'fixed',
    bottom: '16px',
    left: '16px',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    color:'#000',
  },
};
