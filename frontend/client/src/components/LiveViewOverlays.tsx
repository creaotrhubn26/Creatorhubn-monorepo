/**
 * Live View Overlays
 *
 * Dynamic framing guides, safe areas, shot metadata, and pose cue overlays
 */

import React from 'react';

// ==================== DYNAMIC FRAMING GUIDES ====================

export interface SubjectDetection {
  detected: boolean;
  faces: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
  bodies: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
  products: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
}

export interface SafeAreas {
  actionSafe: { x: number; y: number; width: number; height: number };
  titleSafe: { x: number; y: number; width: number; height: number };
  thirds: Array<{ x: number; y: number }>;
  center: { x: number; y: number };
}

interface DynamicFramingGuidesProps {
  subject: SubjectDetection;
  safeAreas: SafeAreas;
  frameWidth: number;
  frameHeight: number;
  showRuleOfThirds?: boolean;
  showSafeAreas?: boolean;
  showSubjectBoxes?: boolean;
  showCenter?: boolean;
}

export const DynamicFramingGuides: React.FC<DynamicFramingGuidesProps> = ({
  subject,
  safeAreas,
  frameWidth,
  frameHeight,
  showRuleOfThirds = true,
  showSafeAreas = true,
  showSubjectBoxes = true,
  showCenter = false,
}) => {
  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.85) return '#00ff00';
    if (confidence > 0.7) return '#ffff00';
    return '#ff8800';
  };

  return (
    <svg
      width={frameWidth}
      height={frameHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 1}}>
      {/* Rule of Thirds */}
      {showRuleOfThirds && (
        <g opacity="0.4">
          {/* Vertical lines */}
          <line
            x1={frameWidth / 3}
            y1="0"
            x2={frameWidth / 3}
            y2={frameHeight}
            stroke="#ffffff"
            strokeWidth="1"
            strokeDasharray="5,5"
          />
          <line
            x1={(frameWidth / 3) * 2}
            y1="0"
            x2={(frameWidth / 3) * 2}
            y2={frameHeight}
            stroke="#ffffff"
            strokeWidth="1"
            strokeDasharray="5,5"
          />
          {/* Horizontal lines */}
          <line
            x1="0"
            y1={frameHeight / 3}
            x2={frameWidth}
            y2={frameHeight / 3}
            stroke="#ffffff"
            strokeWidth="1"
            strokeDasharray="5,5"
          />
          <line
            x1="0"
            y1={(frameHeight / 3) * 2}
            x2={frameWidth}
            y2={(frameHeight / 3) * 2}
            stroke="#ffffff"
            strokeWidth="1"
            strokeDasharray="5,5"
          />
          {/* Intersection points */}
          {safeAreas.thirds.map((point, i) => (
            <circle
              key={`third-${i}`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}
        </g>
      )}

      {/* Safe Areas */}
      {showSafeAreas && (
        <g opacity="0.3">
          {/* Action Safe (90%) */}
          <rect
            x={safeAreas.actionSafe.x}
            y={safeAreas.actionSafe.y}
            width={safeAreas.actionSafe.width}
            height={safeAreas.actionSafe.height}
            fill="none"
            stroke="#00ff00"
            strokeWidth="2"
            strokeDasharray="10,5"
          />
          {/* Title Safe (80%) */}
          <rect
            x={safeAreas.titleSafe.x}
            y={safeAreas.titleSafe.y}
            width={safeAreas.titleSafe.width}
            height={safeAreas.titleSafe.height}
            fill="none"
            stroke="#ffff00"
            strokeWidth="2"
            strokeDasharray="10,5"
          />
        </g>
      )}

      {/* Center Point */}
      {showCenter && (
        <g opacity="0.5">
          <circle
            cx={safeAreas.center.x}
            cy={safeAreas.center.y}
            r="8"
            fill="none"
            stroke="#ff00ff"
            strokeWidth="2"
          />
          <line
            x1={safeAreas.center.x - 15}
            y1={safeAreas.center.y}
            x2={safeAreas.center.x + 15}
            y2={safeAreas.center.y}
            stroke="#ff00ff"
            strokeWidth="2"
          />
          <line
            x1={safeAreas.center.x}
            y1={safeAreas.center.y - 15}
            x2={safeAreas.center.x}
            y2={safeAreas.center.y + 15}
            stroke="#ff00ff"
            strokeWidth="2"
          />
        </g>
      )}

      {/* Subject Detection Boxes */}
      {showSubjectBoxes && subject.detected && (
        <g>
          {/* Faces */}
          {subject.faces.map((face, i) => (
            <g key={`face-${i}`}>
              <rect
                x={face.x}
                y={face.y}
                width={face.width}
                height={face.height}
                fill="none"
                stroke={getConfidenceColor(face.confidence)}
                strokeWidth="3"
                rx="8"
              />
              <text
                x={face.x + 5}
                y={face.y - 8}
                fill={getConfidenceColor(face.confidence)}
                fontSize="14"
                fontFamily="monospace"
                fontWeight="bold"
              >
                👤 FACE {(face.confidence * 100).toFixed(0)}%
              </text>
            </g>
          ))}

          {/* Bodies */}
          {subject.bodies.map((body, i) => (
            <g key={`body-${i}`}>
              <rect
                x={body.x}
                y={body.y}
                width={body.width}
                height={body.height}
                fill="none"
                stroke={getConfidenceColor(body.confidence)}
                strokeWidth="2"
                strokeDasharray="8,4"
              />
              <text
                x={body.x + 5}
                y={body.y + body.height + 20}
                fill={getConfidenceColor(body.confidence)}
                fontSize="12"
                fontFamily="monospace"
              >
                🧍 BODY {(body.confidence * 100).toFixed(0)}%
              </text>
            </g>
          ))}

          {/* Products */}
          {subject.products.map((product, i) => (
            <g key={`product-${i}`}>
              <rect
                x={product.x}
                y={product.y}
                width={product.width}
                height={product.height}
                fill="none"
                stroke="#00ffff"
                strokeWidth="2"
              />
              <text
                x={product.x + 5}
                y={product.y - 8}
                fill="#00ffff"
                fontSize="12"
                fontFamily="monospace"
              >
                📦 PRODUCT {(product.confidence * 100).toFixed(0)}%
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
};

// ==================== POSE CUE OVERLAY ====================

export interface PoseCue {
  bodyPart: string;
  instruction: string;
  arrow: 'up' | 'down' | 'left' | 'right' | 'rotate-left' | 'rotate-right';
  priority: number;
  position: { x: number; y: number };
}

interface PoseCueOverlayProps {
  cues: PoseCue[];
  frameWidth: number;
  frameHeight: number;
}

export const PoseCueOverlay: React.FC<PoseCueOverlayProps> = ({
  cues,
  frameWidth,
  frameHeight,
}) => {
  const getArrowIcon = (arrow: string): string => {
    switch (arrow) {
      case 'up': return '↑';
      case 'down': return '↓';
      case 'left': return '←';
      case 'right': return '→';
      case 'rotate-left': return '↺';
      case 'rotate-right': return '↻';
      default: return '•';
    }
  };

  return (
    <svg
      width={frameWidth}
      height={frameHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 1}}>
      {cues.map((cue, i) => (
        <g key={`cue-${i}`}>
          {/* Arrow background */}
          <rect
            x={cue.position.x - 60}
            y={cue.position.y - 25}
            width="120"
            height="50"
            fill="rgba(0,0,0,0.8)"
            stroke="#ffff00"
            strokeWidth="2"
            rx="8"
          />
          {/* Arrow icon */}
          <text
            x={cue.position.x}
            y={cue.position.y}
            fill="#ffff00"
            fontSize="32"
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {getArrowIcon(cue.arrow)}
          </text>
          {/* Instruction text */}
          <text
            x={cue.position.x}
            y={cue.position.y + 35}
            fill="#ffffff"
            fontSize="12"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {cue.instruction}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ==================== SHOT METADATA OVERLAY ====================

export interface CameraSettings {
  iso?: number;
  aperture?: string;
  shutterSpeed?: string;
  whiteBalance?: number;
  exposureComp?: string;
  focusMode?: string;
  driveMode?: string;
}

export interface ShotMetadata {
  projectName?: string;
  sceneName?: string;
  takeName?: string;
  takeNumber?: number;
  cameraLabel?: string;
  cameraSettings?: CameraSettings;
  timestamp?: string;
  recordingStatus?: 'idle' | 'recording' | 'paused';
  batteryLevel?: number;
  storageRemaining?: string;
}

interface ShotMetadataOverlayProps {
  metadata: ShotMetadata;
  position?: 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showCameraSettings?: boolean;
  showProjectInfo?: boolean;
  showStatus?: boolean;
}

export const ShotMetadataOverlay: React.FC<ShotMetadataOverlayProps> = ({
  metadata,
  position = 'top',
  showCameraSettings = true,
  showProjectInfo = true,
  showStatus = true,
}) => {
  const getPositionStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      padding: '12px 16px',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '13px',
      borderRadius: '6px',
      backdropFilter: 'blur(4px)',
      zIndex: 2,
      border: '1px solid rgba(255,255,255,0.2)',
    };

    switch (position) {
      case 'top': return { ...base, top: '16px', left: '50%', transform: 'translateX(-50%)' };
      case 'bottom': return { ...base, bottom: '16px', left: '50%', transform: 'translateX(-50%)' };
      case 'top-left': return { ...base, top: '16px', left: '16px' };
      case 'top-right': return { ...base, top: '16px', right: '16px' };
      case 'bottom-left': return { ...base, bottom: '16px', left: '16px' };
      case 'bottom-right': return { ...base, bottom: '16px', right: '16px' };
      default: return { ...base, top: '16px', left: '16px' };
    }
  };

  const getRecordingStatusColor = (): string => {
    switch (metadata.recordingStatus) {
      case 'recording': return '#ff0000';
      case 'paused': return '#ffaa00';
      default: return '#00ff00';
    }
  };

  return (
    <div style={getPositionStyles()}>
      {/* Project Info */}
      {showProjectInfo && (metadata.projectName || metadata.sceneName) && (
        <div
          style={{
            marginBottom: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.2)',
            paddingBottom: '6px'}}>
          {metadata.projectName && (
            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>🎬 {metadata.projectName}</div>
          )}
          {metadata.sceneName && (
            <div style={{ fontSize: '12px', marginTop: '2px' }}>Scene: {metadata.sceneName}</div>
          )}
          {metadata.takeName && metadata.takeNumber !== undefined && (
            <div style={{ fontSize: '12px', marginTop: '2px' }}>
              Take: {metadata.takeName} #{metadata.takeNumber}
            </div>
          )}
        </div>
      )}

      {/* Camera Settings */}
      {showCameraSettings && metadata.cameraSettings && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {metadata.cameraSettings.iso && <span>ISO {metadata.cameraSettings.iso}</span>}
          {metadata.cameraSettings.aperture && <span>f/{metadata.cameraSettings.aperture}</span>}
          {metadata.cameraSettings.shutterSpeed && (
            <span>{metadata.cameraSettings.shutterSpeed}</span>
          )}
          {metadata.cameraSettings.whiteBalance && (
            <span>{metadata.cameraSettings.whiteBalance}K</span>
          )}
          {metadata.cameraSettings.exposureComp && (
            <span>EV {metadata.cameraSettings.exposureComp}</span>
          )}
        </div>
      )}

      {/* Status */}
      {showStatus && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            fontSize: '12px'}}>
          {metadata.cameraLabel && <span>📹 {metadata.cameraLabel}</span>}
          {metadata.recordingStatus && (
            <span style={{ color: getRecordingStatusColor(), fontWeight: 'bold' }}>
              {metadata.recordingStatus === 'recording' && '● REC'}
              {metadata.recordingStatus === 'paused' && '⏸ PAUSED'}
              {metadata.recordingStatus === 'idle' && '○ READY'}
            </span>
          )}
          {metadata.batteryLevel !== undefined && <span>🔋 {metadata.batteryLevel}%</span>}
          {metadata.storageRemaining && <span>💾 {metadata.storageRemaining}</span>}
        </div>
      )}

      {/* Timestamp */}
      {metadata.timestamp && (
        <div style={{ fontSize: '11px', marginTop: '6px', opacity: 0.7, textAlign: 'right' }}>
          {metadata.timestamp}
        </div>
      )}
    </div>
  );
};

// ==================== ALERT OVERLAY ====================

export interface Alert {
  type: 'focus' | 'exposure' | 'camera' | 'storage' | 'battery' | 'general';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  icon?: string;
}

interface AlertOverlayProps {
  alerts: Alert[];
  maxVisible?: number;
}

export const AlertOverlay: React.FC<AlertOverlayProps> = ({ alerts, maxVisible = 3 }) => {
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return '#ff0000';
      case 'warning': return '#ffaa00';
      default: return '#00aaff';
    }
  };

  const visibleAlerts = alerts.slice(0, maxVisible);

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 2,
        pointerEvents: 'none'}}>
      {visibleAlerts.map((alert, i) => (
        <div
          key={`alert-${i}`}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            border: `2px solid ${getSeverityColor(alert.severity)}`,
            borderRadius: '8px',
            padding: '12px 20px',
            color: '#ffffff',
            fontFamily: 'monospace',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: '200px',
            animation: 'pulse 1s ease-in-out infinite'}}
        >
          <span style={{ fontSize: '20px' }}>{alert.icon ||'⚠️'}</span>
          <span>{alert.message}</span>
        </div>
      ))}
    </div>
  );
};
