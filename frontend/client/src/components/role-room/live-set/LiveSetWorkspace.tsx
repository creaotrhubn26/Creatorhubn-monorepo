/**
 * LiveSetWorkspace.tsx
 *
 * Top-level container for LIVE SET PRO. Mounter top-bar + mode-spesifikk
 * layout (LIVE / EDIT / REVIEW). EDIT- og REVIEW-modi er stubs som
 * videreutvikles i senere sprints.
 *
 * Speiler livesetmode.md §16 fullt.
 */

import React from 'react';
import { Box, Dialog, Typography } from '@mui/material';
import LiveSetTopBar from './LiveSetTopBar';
import TakesColumn from './TakesColumn';
import ProgramAndMulticam from './ProgramAndMulticam';
import CameraControlsPanel from './CameraControlsPanel';
import SceneInfoColumn from './SceneInfoColumn';
import AudioColumn from './AudioColumn';
import EditModeWorkspace from './EditModeWorkspace';
import ReviewModeWorkspace from './ReviewModeWorkspace';
import { useLiveSetHardware } from './useLiveSetHardware';
import type {
  CameraId,
  CameraPreset,
  CameraSettings,
  LiveSetMode,
} from './types';
import type { SceneBreakdown } from '../models/casting';

const DEFAULT_PRESETS: CameraPreset[] = [
  {
    id: 'wide-establishing',
    name: 'Wide Establishing',
    settings: { fps: 24, shutterAngle: 180, iris: 'f/5.6', iso: 200, whiteBalanceK: 5600, lensFocalLength: '24mm' },
  },
  {
    id: 'two-persons',
    name: 'To personer',
    settings: { fps: 24, shutterAngle: 180, iris: 'f/2.8', iso: 400, whiteBalanceK: 5600, lensFocalLength: '35mm' },
  },
  {
    id: 'close-reaction',
    name: 'Close Reaksjon',
    settings: { fps: 24, shutterAngle: 180, iris: 'f/2.0', iso: 800, whiteBalanceK: 5600, lensFocalLength: '85mm' },
  },
];

const DEFAULT_SETTINGS: CameraSettings = {
  fps: 24,
  shutterAngle: 180,
  iris: 'f/2.8',
  iso: 800,
  whiteBalanceK: 5600,
  focus: 'auto',
  stabilization: true,
  lensFocalLength: '24mm',
  aspectRatio: '1.85:1',
  codec: 'ProRes',
  resolution: '16:9',
};

function formatTimecode(elapsedSec: number): string {
  const hh = Math.floor(elapsedSec / 3600).toString().padStart(2, '0');
  const mm = Math.floor((elapsedSec % 3600) / 60).toString().padStart(2, '0');
  const ss = Math.floor(elapsedSec % 60).toString().padStart(2, '0');
  const ff = Math.floor((elapsedSec % 1) * 24).toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}:${ff}`;
}

export interface LiveSetWorkspaceProps {
  projectId: string;
  projectName: string;
  scene: SceneBreakdown;
  open: boolean;
  onClose: () => void;
}

export const LiveSetWorkspace: React.FC<LiveSetWorkspaceProps> = ({
  projectId,
  projectName,
  scene,
  open,
  onClose,
}) => {
  const [mode, setMode] = React.useState<LiveSetMode>('live');
  const [programCameraId, setProgramCameraId] = React.useState<CameraId>('A');
  const [activeCameraId, setActiveCameraId] = React.useState<CameraId>('A');
  const [settings, setSettings] = React.useState<CameraSettings>(DEFAULT_SETTINGS);
  const [presets, setPresets] = React.useState<CameraPreset[]>(DEFAULT_PRESETS);
  const [scopeMode, setScopeMode] = React.useState<'waveform' | 'vectorscope'>('waveform');
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = React.useState<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = React.useState(0);
  const [selectedTakeId, setSelectedTakeId] = React.useState<string | null>(null);

  const { cameras, masterAudioDb, syncStatus, crewCount } = useLiveSetHardware();

  // Recording-timer
  React.useEffect(() => {
    if (!isRecording || !recordingStartedAt) {
      setRecordingElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setRecordingElapsed((Date.now() - recordingStartedAt) / 1000);
    }, 50);
    return () => clearInterval(timer);
  }, [isRecording, recordingStartedAt]);

  // Keyboard shortcuts
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggleRoll();
      } else if (e.key === 't' || e.key === 'T') {
        if (isRecording) toggleRoll();
      } else if (e.key === 's' || e.key === 'S') {
        handleSnapshot();
      } else if (e.key === 'a' || e.key === 'A') {
        // Auto cut — placeholder
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isRecording]);

  const toggleRoll = () => {
    if (isRecording) {
      setIsRecording(false);
      setRecordingStartedAt(null);
    } else {
      setIsRecording(true);
      setRecordingStartedAt(Date.now());
    }
  };

  const handleSnapshot = () => {
    // TODO: trigger /api/ccapi/cameras/:ip/shutter via Canon backend-proxy
    console.log('[LiveSetWorkspace] snapshot triggered');
  };

  const handleSettingsChange = (patch: Partial<CameraSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    // TODO: POST til /api/ccapi/cameras/:ip/settings når proxy er live
  };

  const handleApplyPreset = (preset: CameraPreset) => {
    setSettings((current) => ({ ...current, ...preset.settings }));
  };

  const handleSavePreset = () => {
    const name = window.prompt('Navn på preset:');
    if (!name) return;
    setPresets((current) => [...current, { id: `preset-${Date.now()}`, name, settings }]);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: { bgcolor: '#0a0a0a', color: '#fff' },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <LiveSetTopBar
          projectName={projectName}
          sceneLabel={`Scene ${scene.sceneNumber ?? '?'}`}
          mode={mode}
          onModeChange={setMode}
          isRecording={isRecording}
          syncStatus={syncStatus}
          crewCount={crewCount}
          onClose={onClose}
        />

        {mode === 'live' && (
          <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {/* Left column: TAKES */}
            <Box sx={{ width: 280, flexShrink: 0 }}>
              <TakesColumn
                projectId={projectId}
                sceneId={scene.id}
                selectedTakeId={selectedTakeId}
                onTakeSelect={(take) => setSelectedTakeId(take.id)}
              />
            </Box>

            {/* Center column: PROGRAM + multicam + roll + camera controls */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ProgramAndMulticam
                  cameras={cameras}
                  programCameraId={programCameraId}
                  onSelectProgramCamera={setProgramCameraId}
                  programSettings={settings}
                  isRecording={isRecording}
                  recordingTimecode={formatTimecode(recordingElapsed)}
                  onRoll={toggleRoll}
                  onCut={toggleRoll}
                  onAutoCut={() => console.log('[LiveSetWorkspace] auto-cut triggered')}
                  onSnapshot={handleSnapshot}
                />
              </Box>
              <CameraControlsPanel
                cameras={cameras}
                activeCameraId={activeCameraId}
                onActiveCameraChange={setActiveCameraId}
                settings={settings}
                onSettingsChange={handleSettingsChange}
                presets={presets}
                onApplyPreset={handleApplyPreset}
                onSavePreset={handleSavePreset}
                scopeMode={scopeMode}
                onScopeModeChange={setScopeMode}
              />
            </Box>

            {/* Right column: SCENE INFO + QUICK ACTIONS + CAM METADATA */}
            <Box sx={{ width: 320, flexShrink: 0 }}>
              <SceneInfoColumn
                scene={scene}
                cameras={cameras}
                activeCameraId={activeCameraId}
                activeCameraSettings={settings}
                onQuickAction={(action) => console.log('[LiveSetWorkspace] quick-action:', action)}
              />
            </Box>

            {/* Far right: AUDIO */}
            <Box sx={{ width: 200, flexShrink: 0 }}>
              <AudioColumn
                masterDb={masterAudioDb}
                cameras={cameras}
                onOpenMixer={() => console.log('[LiveSetWorkspace] open mixer')}
              />
            </Box>
          </Box>
        )}

        {mode === 'edit' && (
          <EditModeWorkspace projectId={projectId} sceneId={scene.id} />
        )}

        {mode === 'review' && (
          <ReviewModeWorkspace projectId={projectId} sceneId={scene.id} />
        )}
      </Box>
    </Dialog>
  );
};

export default LiveSetWorkspace;
