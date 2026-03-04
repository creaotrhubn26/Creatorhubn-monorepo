/**
 * AnimationRecorder - Record transforms as keyframes in real-time
 * 
 * Features:
 * - Real-time transform recording
 * - Configurable sample rate
 * - Multi-track recording
 * - Keyframe simplification/optimization
 * - Recording playback preview
 */

import * as THREE from 'three';
import type {
  Keyframe,
  AnimationTrack,
  AnimationClip,
  TrackType,
  EasingName,
} from './SceneGraphAnimationEngine';

// ============================================================================
// Types
// ============================================================================

export interface RecordingConfig {
  sampleRate: number;         // Samples per second (e.g., 30 = 30fps)
  recordPosition: boolean;
  recordRotation: boolean;
  recordScale: boolean;
  recordCustomProperties: string[];  // e.g., ['power','colorTemperature']
  simplifyKeyframes: boolean; // Remove redundant keyframes
  simplifyThreshold: number;  // Minimum change to create keyframe
  defaultEasing: EasingName;
}

export interface RecordingSession {
  id: string;
  nodeId: string;
  startTime: number;
  duration: number;
  config: RecordingConfig;
  tracks: Map<TrackType, RecordedKeyframe[]>;
  isRecording: boolean;
  isPaused: boolean;
}

export interface RecordedKeyframe {
  time: number;
  value: any;
  rawValue: any; // Original unprocessed value
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  currentTime: number;
  activeSessions: string[];
  samplesRecorded: number;
}

// ============================================================================
// Default Config
// ============================================================================

export const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
  sampleRate: 30,
  recordPosition: true,
  recordRotation: true,
  recordScale: false,
  recordCustomProperties: [],
  simplifyKeyframes: true,
  simplifyThreshold: 0.001,
  defaultEasing: 'linear',
};

// ============================================================================
// Animation Recorder
// ============================================================================

export class AnimationRecorder {
  private sessions: Map<string, RecordingSession> = new Map();
  private globalStartTime: number | null = null;
  private frameId: number | null = null;
  private clock: THREE.Clock = new THREE.Clock();
  private listeners: Set<(state: RecordingState) => void> = new Set();

  // -------------------------------------------------------------------------
  // Session Management
  // -------------------------------------------------------------------------

  startRecording(
    nodeId: string,
    config: Partial<RecordingConfig> = {}
  ): RecordingSession {
    const fullConfig: RecordingConfig = { ...DEFAULT_RECORDING_CONFIG, ...config };
    
    const session: RecordingSession = {
      id: `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nodeId,
      startTime: Date.now(),
      duration: 0,
      config: fullConfig,
      tracks: new Map(),
      isRecording: true,
      isPaused: false,
    };

    // Initialize tracks
    if (fullConfig.recordPosition) {
      session.tracks.set('position,', []);
    }
    if (fullConfig.recordRotation) {
      session.tracks.set('rotation', []);
    }
    if (fullConfig.recordScale) {
      session.tracks.set('scale', []);
    }
    fullConfig.recordCustomProperties.forEach((prop) => {
      session.tracks.set(prop as TrackType, []);
    });

    this.sessions.set(session.id, session);

    // Start recording loop if first session
    if (this.sessions.size === 1) {
      this.startRecordingLoop();
    }

    this.notify();
    return session;
  }

  pauseRecording(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isPaused = true;
      this.notify();
    }
  }

  resumeRecording(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isPaused = false;
      this.notify();
    }
  }

  stopRecording(sessionId: string): RecordingSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.isRecording = false;
    session.duration = (Date.now() - session.startTime) / 1000;

    // Simplify keyframes if enabled
    if (session.config.simplifyKeyframes) {
      this.simplifySession(session);
    }

    this.sessions.delete(sessionId);

    // Stop loop if no more sessions
    if (this.sessions.size === 0) {
      this.stopRecordingLoop();
    }

    this.notify();
    return session;
  }

  stopAllRecordings(): RecordingSession[] {
    const results: RecordingSession[] = [];
    for (const sessionId of this.sessions.keys()) {
      const session = this.stopRecording(sessionId);
      if (session) results.push(session);
    }
    return results;
  }

  // -------------------------------------------------------------------------
  // Recording Loop
  // -------------------------------------------------------------------------

  private startRecordingLoop(): void {
    if (this.frameId !== null) return;

    this.globalStartTime = Date.now();
    this.clock.start();

    const record = () => {
      this.frameId = requestAnimationFrame(record);
      // Recording is done via recordSample() called externally
    };

    record();
  }

  private stopRecordingLoop(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.clock.stop();
    this.globalStartTime = null;
  }

  // -------------------------------------------------------------------------
  // Sample Recording
  // -------------------------------------------------------------------------

  recordSample(
    sessionId: string,
    transform: {
      position?: THREE.Vector3;
      rotation?: THREE.Euler;
      scale?: THREE.Vector3;
      customProperties?: Record<string, any>;
    }
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isRecording || session.isPaused) return;

    const elapsedTime = (Date.now() - session.startTime) / 1000;

    // Check sample rate
    const lastSampleTime = this.getLastSampleTime(session);
    const minInterval = 1 / session.config.sampleRate;
    if (lastSampleTime !== null && elapsedTime - lastSampleTime < minInterval) {
      return;
    }

    // Record each enabled track
    if (session.config.recordPosition && transform.position) {
      this.recordTrackSample(session, 'position', elapsedTime, {
        x: transform.position.x,
        y: transform.position.y,
        z: transform.position.z,
      });
    }

    if (session.config.recordRotation && transform.rotation) {
      this.recordTrackSample(session, 'rotation', elapsedTime, {
        x: transform.rotation.x,
        y: transform.rotation.y,
        z: transform.rotation.z,
        order: transform.rotation.order,
      });
    }

    if (session.config.recordScale && transform.scale) {
      this.recordTrackSample(session, 'scale', elapsedTime, {
        x: transform.scale.x,
        y: transform.scale.y,
        z: transform.scale.z,
      });
    }

    if (transform.customProperties) {
      for (const [prop, value] of Object.entries(transform.customProperties)) {
        if (session.config.recordCustomProperties.includes(prop)) {
          this.recordTrackSample(session, prop as TrackType, elapsedTime, value);
        }
      }
    }

    this.notify();
  }

  private recordTrackSample(
    session: RecordingSession,
    trackType: TrackType,
    time: number,
    value: any
  ): void {
    const track = session.tracks.get(trackType);
    if (!track) return;

    track.push({
      time,
      value: this.cloneValue(value),
      rawValue: value,
    });
  }

  private getLastSampleTime(session: RecordingSession): number | null {
    let lastTime: number | null = null;

    for (const track of session.tracks.values()) {
      if (track.length > 0) {
        const trackLastTime = track[track.length - 1].time;
        if (lastTime === null || trackLastTime > lastTime) {
          lastTime = trackLastTime;
        }
      }
    }

    return lastTime;
  }

  private cloneValue(value: any): any {
    if (typeof value !== 'object' || value === null) return value;
    if (value instanceof THREE.Vector3) {
      return { x: value.x, y: value.y, z: value.z };
    }
    if (value instanceof THREE.Euler) {
      return { x: value.x, y: value.y, z: value.z, order: value.order };
    }
    if (value instanceof THREE.Color) {
      return { r: value.r, g: value.g, b: value.b };
    }
    return { ...value };
  }

  // -------------------------------------------------------------------------
  // Keyframe Simplification
  // -------------------------------------------------------------------------

  private simplifySession(session: RecordingSession): void {
    for (const [trackType, samples] of session.tracks) {
      const simplified = this.simplifyTrack(samples, session.config.simplifyThreshold);
      session.tracks.set(trackType, simplified);
    }
  }

  private simplifyTrack(
    samples: RecordedKeyframe[],
    threshold: number
  ): RecordedKeyframe[] {
    if (samples.length <= 2) return samples;

    const simplified: RecordedKeyframe[] = [samples[0]];

    for (let i = 1; i < samples.length - 1; i++) {
      const prev = simplified[simplified.length - 1];
      const curr = samples[i];
      const next = samples[i + 1];

      // Check if this keyframe is necessary
      if (this.isSignificantChange(prev.value, curr.value, next.value, threshold)) {
        simplified.push(curr);
      }
    }

    // Always keep last keyframe
    simplified.push(samples[samples.length - 1]);

    return simplified;
  }

  private isSignificantChange(prev: any, curr: any, next: any, threshold: number): boolean {
    // For numbers
    if (typeof curr === 'number') {
      const linearInterp = (prev + next) / 2;
      return Math.abs(curr - linearInterp) > threshold;
    }

    // For vectors
    if (curr && typeof curr === 'object' && 'x' in curr) {
      const interpX = (prev.x + next.x) / 2;
      const interpY = (prev.y + next.y) / 2;
      const interpZ = (prev.z + next.z) / 2;

      const dx = Math.abs(curr.x - interpX);
      const dy = Math.abs(curr.y - interpY);
      const dz = Math.abs(curr.z - interpZ);

      return dx > threshold || dy > threshold || dz > threshold;
    }

    // Default: keep keyframe
    return true;
  }

  // -------------------------------------------------------------------------
  // Convert to Animation Clip
  // -------------------------------------------------------------------------

  sessionToClip(session: RecordingSession, clipName?: string): AnimationClip {
    const tracks: AnimationTrack[] = [];

    for (const [trackType, samples] of session.tracks) {
      if (samples.length === 0) continue;

      const keyframes: Keyframe[] = samples.map((sample) => ({
        time: sample.time,
        value: this.convertToAnimationValue(sample.value, trackType),
        easing: session.config.defaultEasing,
      }));

      tracks.push({
        id: `track_${trackType}_${Date.now()}`,
        nodeId: session.nodeId,
        type: trackType,
        propertyPath: trackType,
        keyframes,
        enabled: true,
        blendMode: 'override',
        weight: 1,
        loop: false,
        loopCount: 1,
      });
    }

    return {
      id: `clip_${Date.now()}`,
      name: clipName || `Recording ${new Date().toLocaleTimeString()}`,
      duration: session.duration,
      tracks,
      fps: session.config.sampleRate,
      loop: false,
    };
  }

  private convertToAnimationValue(value: any, trackType: TrackType): any {
    switch (trackType) {
      case 'position':
      case 'scale':
        return new THREE.Vector3(value.x, value.y, value.z);
      case 'rotation':
        return new THREE.Euler(value.x, value.y, value.z, value.order ||'XYZ');
      default:
        return value;
    }
  }

  // -------------------------------------------------------------------------
  // State & Subscription
  // -------------------------------------------------------------------------

  getState(): RecordingState {
    return {
      isRecording: this.sessions.size > 0,
      isPaused: Array.from(this.sessions.values()).every((s) => s.isPaused),
      currentTime: this.globalStartTime
        ? (Date.now() - this.globalStartTime) / 1000
        : 0,
      activeSessions: Array.from(this.sessions.keys()),
      samplesRecorded: Array.from(this.sessions.values()).reduce(
        (sum, session) =>
          sum +
          Array.from(session.tracks.values()).reduce((tSum, track) => tSum + track.length, 0),
        0
      ),
    };
  }

  getSession(sessionId: string): RecordingSession | undefined {
    return this.sessions.get(sessionId);
  }

  subscribe(listener: (state: RecordingState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}

// Export singleton
export const animationRecorder = new AnimationRecorder();

export default animationRecorder;
