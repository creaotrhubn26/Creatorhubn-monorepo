import { useTheming } from '../utils/theming-helper';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AIDirectorPanel from './AIDirectorPanel';
import DynamicFramingGuides from './DynamicFramingGuides';
import PoseCueOverlay from './PoseCueOverlay';
import ShotMetadataOverlay from './ShotMetadataOverlay';
import AlertOverlay from './AlertOverlay';
import HistogramDisplay from './HistogramDisplay';
import WaveformMonitor from './WaveformMonitor';

interface VisionMetadata {
  frameWidth: number;
  frameHeight: number;
}

interface VisionData {
  subject?: unknown;
  safeAreas?: unknown;
  metadata: VisionMetadata;
}

interface PoseCue {
  id: string;
  label: string;
  confidence: number;
  x: number;
  y: number;
}

interface AlertItem {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

interface DirectorAnalysis {
  summary?: string;
  suggestions?: string[];
}

interface ShotMetadata {
  projectName: string;
  sceneName: string;
  timestamp: string;
  recordingStatus: 'idle' | 'recording';
}

interface OverlayToggleConfig {
  focusPeaking: { enabled: boolean };
  zebraStripes: { enabled: boolean };
  falseColor: { enabled: boolean };
}

interface LiveViewMonitorProps {
  autoStart?: boolean;
  showDirectorPanel?: boolean;
  showFramingGuides?: boolean;
  showWaveform?: boolean;
  showHistogram?: boolean;
  showMetadata?: boolean;
  projectName?: string;
  sceneName?: string;
}

const LiveViewMonitor: React.FC<LiveViewMonitorProps> = ({
  autoStart = false,
  showDirectorPanel = true,
  showFramingGuides: showFramingGuidesDefault = true,
  showWaveform = true,
  showHistogram = true,
  showMetadata = true,
  projectName = 'Untitled Project',
  sceneName = 'Scene 1',
}) => {
  const theming = useTheming('photographer');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isLiveViewActive, setIsLiveViewActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showFramingGuides, setShowFramingGuides] = useState(showFramingGuidesDefault);

  const [visionData, setVisionData] = useState<VisionData | null>(null);
  const [poseCues, setPoseCues] = useState<PoseCue[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [directorAnalysis, setDirectorAnalysis] = useState<DirectorAnalysis>({});
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [histogramData, setHistogramData] = useState<number[]>([]);
  const [overlayConfig, setOverlayConfig] = useState<OverlayToggleConfig>({
    focusPeaking: { enabled: false },
    zebraStripes: { enabled: false },
    falseColor: { enabled: false },
  });

  const [shotMetadata, setShotMetadata] = useState<ShotMetadata>({
    projectName,
    sceneName,
    timestamp: new Date().toLocaleTimeString(),
    recordingStatus: 'idle',
  });

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket('ws://localhost:5001/ws/live-view');

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(
        JSON.stringify({
          type: 'init',
          source: 'live-view-monitor',
          projectName,
          sceneName,
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          visionData?: VisionData;
          poseCues?: PoseCue[];
          alerts?: AlertItem[];
          analysis?: DirectorAnalysis;
          waveform?: number[];
          histogram?: number[];
        };

        if (payload.visionData) {
          setVisionData(payload.visionData);
        }
        if (payload.poseCues) {
          setPoseCues(payload.poseCues);
        }
        if (payload.alerts) {
          setAlerts(payload.alerts);
        }
        if (payload.analysis) {
          setDirectorAnalysis(payload.analysis);
        }
        if (payload.waveform) {
          setWaveformData(payload.waveform);
        }
        if (payload.histogram) {
          setHistogramData(payload.histogram);
        }
      } catch (error) {
        console.error('[LiveViewMonitor] Failed to parse WS message', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (isLiveViewActive) {
        setTimeout(connectWebSocket, 1500);
      }
    };

    ws.onerror = (error) => {
      console.error('[LiveViewMonitor] WebSocket error', error);
    };

    wsRef.current = ws;
  }, [isLiveViewActive, projectName, sceneName]);

  const startFrameStreaming = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !wsRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;

    frameIntervalRef.current = setInterval(() => {
      if (
        wsRef.current?.readyState === WebSocket.OPEN &&
        video.readyState === video.HAVE_ENOUGH_DATA
      ) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        wsRef.current.send(
          JSON.stringify({
            type: 'frame',
            frameData: canvas.toDataURL('image/jpeg', 0.8),
            frameWidth: canvas.width,
            frameHeight: canvas.height,
            overlayConfig,
            shotContext: {
              projectName,
              sceneName,
              timestamp: Date.now(),
            },
          }),
        );

        setShotMetadata((prev) => ({
          ...prev,
          timestamp: new Date().toLocaleTimeString(),
        }));
      }
    }, 1000 / 30);
  }, [overlayConfig, projectName, sceneName]);

  const stopLiveView = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    setIsLiveViewActive(false);
    setShotMetadata((prev) => ({ ...prev, recordingStatus: 'idle' }));
  }, []);

  const startLiveView = useCallback(async () => {
    try {
      if (!isConnected) {
        connectWebSocket();
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      setIsLiveViewActive(true);
      setShotMetadata((prev) => ({ ...prev, recordingStatus: 'recording' }));
      startFrameStreaming();
    } catch (error) {
      console.error('[LiveViewMonitor] Error starting live view:', error);
      setAlerts((prev) => [
        ...prev,
        {
          id: `live-view-error-${Date.now()}`,
          severity: 'error',
          message: 'Klarte ikke å starte live view. Sjekk kamera-tillatelse.',
        },
      ]);
    }
  }, [connectWebSocket, isConnected, startFrameStreaming]);

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

  useEffect(() => {
    connectWebSocket();

    if (autoStart) {
      void startLiveView();
    }

    return () => {
      stopLiveView();
      wsRef.current?.close();
    };
  }, [autoStart, connectWebSocket, startLiveView, stopLiveView]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.liveViewContainer}>
        <div style={styles.videoWrapper}>
          <video ref={videoRef} style={{ display: 'none' }} autoPlay muted />
          <canvas ref={canvasRef} style={styles.canvas} />

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
              frameWidth={visionData?.metadata.frameWidth ?? 1920}
              frameHeight={visionData?.metadata.frameHeight ?? 1080}
            />
          )}

          {showMetadata && <ShotMetadataOverlay metadata={shotMetadata} position="top-left" />}
          {alerts.length > 0 && <AlertOverlay alerts={alerts} maxVisible={3} />}
        </div>

        <div style={styles.controls}>
          <button style={styles.button} onClick={isLiveViewActive ? stopLiveView : () => void startLiveView()}>
            {isLiveViewActive ? '⏹ Stop' : '▶ Start'} Live View
          </button>

          <button style={styles.button} onClick={() => setShowFramingGuides((prev) => !prev)}>
            {showFramingGuides ? 'Guides On' : 'Guides Off'}
          </button>

          <button
            style={styles.button}
            onClick={() =>
              setOverlayConfig((prev) => ({
                ...prev,
                focusPeaking: { ...prev.focusPeaking, enabled: !prev.focusPeaking.enabled },
              }))
            }
          >
            {overlayConfig.focusPeaking.enabled ? 'Focus: On' : 'Focus: Off'}
          </button>

          <button
            style={styles.button}
            onClick={() =>
              setOverlayConfig((prev) => ({
                ...prev,
                zebraStripes: { ...prev.zebraStripes, enabled: !prev.zebraStripes.enabled },
              }))
            }
          >
            {overlayConfig.zebraStripes.enabled ? 'Zebras: On' : 'Zebras: Off'}
          </button>

          <button
            style={styles.button}
            onClick={() =>
              setOverlayConfig((prev) => ({
                ...prev,
                falseColor: { ...prev.falseColor, enabled: !prev.falseColor.enabled },
              }))
            }
          >
            {overlayConfig.falseColor.enabled ? 'False Color: On' : 'False Color: Off'}
          </button>
        </div>
      </div>

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

      <div style={styles.bottomPanel}>
        {showWaveform && <WaveformMonitor data={waveformData} width={512} height={200} />}
        {showHistogram && <HistogramDisplay data={histogramData} width={512} height={200} />}
      </div>

      <div
        style={{
          ...styles.statusIndicator,
          backgroundColor: isConnected ? '#00ff00' : '#ff0000',
          color: theming.colors.background,
        }}
      >
        {isConnected ? '● CONNECTED' : '○ DISCONNECTED'}
      </div>
    </div>
  );
};

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
    flexWrap: 'wrap',
  },
  button: {
    padding: '8px 14px',
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    border: '1px solid #444',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  },
  rightPanel: {
    borderTop: '1px solid #222',
    padding: '12px 16px',
    backgroundColor: '#111',
  },
  bottomPanel: {
    display: 'flex',
    gap: '12px',
    padding: '12px 16px',
    borderTop: '1px solid #222',
    backgroundColor: '#0f0f0f',
  },
  statusIndicator: {
    position: 'fixed',
    top: '12px',
    right: '12px',
    padding: '6px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.06em',
  },
};

export default LiveViewMonitor;
