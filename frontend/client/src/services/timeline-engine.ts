// @ts-nocheck
/**
 * TIMELINE ENGINE
 * Frame-accurate timeline calculations and clip management
 * Handles trimming, ripple edits, transitions, and effect stacking
 */

import type { BeatClip, Track } from './storyArcDataIntegration';

export interface TimelineConfig {
  frameRate: number;
  sampleRate: number;
  width: number;
  height: number;
  duration: number;
}

export interface ClipEdit {
  clipId: string;
  property: 'start' | 'duration' | 'inPoint' | 'outPoint' | 'trackId';
  value: number | string;
}

export interface RippleEditResult {
  affectedClips: string[];
  newPositions: Map<string, number>;
}

export interface TimelineValidationTransition {
  id?: string;
  time: number;
  trackId: string;
  type?: string;
  duration?: number;
  clipId?: string;
  edge?: 'in' | 'out';
  layer?: 'video' | 'audio';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getTransitionEdgeMetadata(clip: BeatClip, edge: 'in' | 'out'): Record<string, unknown> | null {
  if (!isRecord(clip.metadata) || !isRecord(clip.metadata.transitions)) {
    return null;
  }
  const entry = clip.metadata.transitions[edge];
  return isRecord(entry) ? entry : null;
}

class TimelineEngine {
  private config: TimelineConfig = {
    frameRate: 25,
    sampleRate: 48000,
    width: 1920,
    height: 1080,
    duration: 0
  };
  
  /**
   * Convert seconds to frames
   */
  secondsToFrames(seconds: number): number {
    return Math.floor(seconds * this.config.frameRate);
  }
  
  /**
   * Convert frames to seconds
   */
  framesToSeconds(frames: number): number {
    return frames / this.config.frameRate;
  }
  
  /**
   * Snap time to nearest frame boundary
   */
  snapToFrame(time: number): number {
    const frames = Math.round(time * this.config.frameRate);
    return frames / this.config.frameRate;
  }
  
  /**
   * Check if clips overlap on same track
   */
  checkOverlap(clip1: BeatClip, clip2: BeatClip): boolean {
    if (clip1.trackId !== clip2.trackId) return false;
    
    const clip1End = clip1.start + clip1.duration;
    const clip2End = clip2.start + clip2.duration;
    
    return !(clip1End <= clip2.start || clip2End <= clip1.start);
  }
  
  /**
   * Find gaps in timeline (empty spaces)
   */
  findGaps(clips: BeatClip[], trackId: string): Array<{ start: number; end: number }> {
    const trackClips = clips
      .filter(c => c.trackId === trackId)
      .sort((a, b) => a.start - b.start);
    
    const gaps: Array<{ start: number; end: number }> = [];
    let lastEnd = 0;
    
    trackClips.forEach(clip => {
      if (clip.start > lastEnd) {
        gaps.push({ start: lastEnd, end: clip.start });
      }
      lastEnd = Math.max(lastEnd, clip.start + clip.duration);
    });
    
    return gaps;
  }
  
  /**
   * Ripple edit - move clip and shift everything after it
   */
  rippleEdit(clips: BeatClip[], clipId: string, newStart: number): RippleEditResult {
    const clipIndex = clips.findIndex(c => c.id === clipId);
    if (clipIndex === -1) return { affectedClips: [], newPositions: new Map() };
    
    const clip = clips[clipIndex];
    const delta = newStart - clip.start;
    const trackId = clip.trackId;
    
    const affectedClips: string[] = [clipId];
    const newPositions = new Map<string, number>();
    
    // Move the clip
    newPositions.set(clipId, newStart);
    
    // Shift all clips on same track that come after this clip
    clips.forEach(c => {
      if (c.trackId === trackId && c.start >= clip.start + clip.duration && c.id !== clipId) {
        affectedClips.push(c.id);
        newPositions.set(c.id, this.snapToFrame(c.start + delta));
      }
    });
    
    return { affectedClips, newPositions };
  }
  
  /**
   * Trim clip (change in/out points)
   */
  trimClip(clip: BeatClip, inPoint: number, outPoint: number): BeatClip {
    return {
      ...clip,
      metadata: {
        ...clip.metadata,
        inPoint: this.snapToFrame(inPoint),
        outPoint: this.snapToFrame(outPoint)
      },
      duration: this.snapToFrame(outPoint - inPoint)
    };
  }
  
  /**
   * Split clip at playhead
   */
  splitClip(clip: BeatClip, splitTime: number): [BeatClip, BeatClip] {
    const localTime = splitTime - clip.start;
    
    const clip1: BeatClip = {
      ...clip,
      id: `${clip.id}_1`,
      duration: this.snapToFrame(localTime),
      metadata: {
        ...clip.metadata,
        outPoint: (clip.metadata?.inPoint || 0) + localTime
      }
    };
    
    const clip2: BeatClip = {
      ...clip,
      id: `${clip.id}_2`,
      start: this.snapToFrame(clip.start + localTime),
      duration: this.snapToFrame(clip.duration - localTime),
      metadata: {
        ...clip.metadata,
        inPoint: (clip.metadata?.inPoint || 0) + localTime
      }
    };
    
    return [clip1, clip2];
  }
  
  /**
   * Calculate total timeline duration
   */
  calculateDuration(clips: BeatClip[]): number {
    if (clips.length === 0) return 0;
    
    const maxEnd = Math.max(...clips.map(c => c.start + c.duration));
    return this.snapToFrame(maxEnd);
  }
  
  private isTransitionOverlapPair(
    left: BeatClip,
    right: BeatClip,
    transitions: TimelineValidationTransition[],
    frameTime: number
  ): boolean {
    if (left.trackId !== right.trackId) {
      return false;
    }

    const overlapStart = Math.max(left.start, right.start);
    const overlapEnd = Math.min(left.start + left.duration, right.start + right.duration);
    if (overlapEnd - overlapStart <= frameTime / 3) {
      return false;
    }

    const transitionAtCut = transitions.some((transition) => {
      if (transition.trackId !== left.trackId) {
        return false;
      }
      if (transition.edge === 'out' && transition.clipId === left.id) {
        return transition.time >= overlapStart - frameTime && transition.time <= overlapEnd + frameTime;
      }
      if (transition.edge === 'in' && transition.clipId === right.id) {
        return transition.time >= overlapStart - frameTime && transition.time <= overlapEnd + frameTime;
      }
      if (transition.clipId && transition.clipId !== left.id && transition.clipId !== right.id) {
        return false;
      }
      return transition.time >= overlapStart - frameTime && transition.time <= overlapEnd + frameTime;
    });
    if (transitionAtCut) {
      return true;
    }

    const leftOut = getTransitionEdgeMetadata(left, 'out');
    const rightIn = getTransitionEdgeMetadata(right, 'in');
    const leftTargetsRight = leftOut?.targetClipId === right.id;
    const rightTargetsLeft = rightIn?.sourceClipId === left.id;
    if (leftTargetsRight || rightTargetsLeft) {
      return true;
    }

    return false;
  }

  /**
   * Validate timeline (check for overlaps, gaps, etc.)
   */
  validateTimeline(
    clips: BeatClip[],
    tracks: Track[],
    transitions: TimelineValidationTransition[] = []
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const effectiveFrameTime = this.frameRate > 0 ? 1 / this.frameRate : this.frameTime;

    // Check for overlaps on video tracks (ignore explicit transition overlaps)
    const videoTracks = tracks.filter(t => t.type === 'video');
    videoTracks.forEach(track => {
      const trackClips = clips
        .filter(c => c.trackId === track.id)
        .sort((a, b) => a.start - b.start);
      
      for (let i = 0; i < trackClips.length - 1; i++) {
        const current = trackClips[i];
        const next = trackClips[i + 1];
        
        if (current.start + current.duration > next.start) {
          if (this.isTransitionOverlapPair(current, next, transitions, effectiveFrameTime)) {
            continue;
          }
          errors.push(`Clips ${current.id} and ${next.id} overlap on track ${track.id}`);
        }
      }
    });
    
    // Check for gaps
    tracks.forEach(track => {
      const gaps = this.findGaps(clips, track.id);
      if (gaps.length > 0) {
        warnings.push(`Track ${track.id} has ${gaps.length} gap(s)`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Generate EDL (Edit Decision List) for export
   */
  generateEDL(clips: BeatClip[], tracks: Track[]): string {
    let edl = 'TITLE: Story Arc Edit\n';
    edl += `FCM: NON-DROP FRAME\n\n`;
    
    clips.forEach((clip, index) => {
      const num = String(index + 1).padStart(3, '0');
      const inTC = this.formatEDLTimecode(clip.metadata?.inPoint || 0);
      const outTC = this.formatEDLTimecode((clip.metadata?.outPoint || clip.duration));
      const recInTC = this.formatEDLTimecode(clip.start);
      const recOutTC = this.formatEDLTimecode(clip.start + clip.duration);
      
      edl += `${num}  ${clip.sourceFile || 'AX'}       V     C        ${inTC} ${outTC} ${recInTC} ${recOutTC}\n`;
      edl += `* FROM CLIP NAME: ${clip.beatName}\n\n`;
    });
    
    return edl;
  }
  
  /**
   * Format timecode for EDL (HH:MM:SS:FF)
   */
  private formatEDLTimecode(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * this.config.frameRate);
    
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  }
  
  /**
   * Set configuration
   */
  setConfig(config: Partial<TimelineConfig>) {
    this.config = { ...this.config, ...config };
    if (typeof this.config.frameRate === 'number' && this.config.frameRate > 0) {
      this.frameRate = this.config.frameRate;
      this.frameTime = 1 / this.config.frameRate;
    }
  }
  
  /**
   * Get configuration
   */
  getConfig(): TimelineConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const timelineEngine = new TimelineEngine();
