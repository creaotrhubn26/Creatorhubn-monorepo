/**
 * REAL VIDEO PLAYBACK ENGINE
 * Frame-accurate video playback with canvas rendering and audio sync
 * Uses native <video> element + WebAudio for now (WebCodecs upgrade later)
 */

import type { BeatClip, Track } from './storyArcDataIntegration';

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  direction: 'forward' | 'reverse';
  isLooping: boolean;
}

export interface VideoSource {
  id: string;
  url: string;
  videoElement?: HTMLVideoElement;
  audioSource?: MediaElementAudioSourceNode;
  duration: number;
  width: number;
  height: number;
  frameRate: number;
}

class VideoPlaybackEngine {
  // Core elements
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Playback state
  private currentTime: number = 0;
  private isPlaying: boolean = false;
  private playbackRate: number = 1;
  private isLooping: boolean = false;
  private duration: number = 0;
  
  // Timeline data
  private clips: BeatClip[] = [];
  private tracks: Track[] = [];
  private videoSources: Map<string, VideoSource> = new Map();
  
  // Animation frame
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  
  // Frame rate (configurable)
  private frameRate: number = 25; // PAL standard
  private frameTime: number = 1 / 25;
  
  // Callbacks
  private onTimeUpdate?: (time: number) => void;
  private onPlayStateChange?: (isPlaying: boolean) => void;
  private onFrame?: (time: number, frame: number) => void;
  
  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
  }
  
  /**
   * Initialize canvas for video rendering
   */
  initCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true // Better performance
    });
    
    // Set canvas size (1080p default)
    canvas.width = 1920;
    canvas.height = 1080;
    
    console.log(`✅ Canvas initialized: ${canvas.width}x${canvas.height}`);
  }
  
  /**
   * Load video file and prepare for playback
   */
  async loadVideo(url: string, clipId: string): Promise<VideoSource> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      
      video.addEventListener('loadedmetadata', () => {
        // Create audio source
        const audioSource = this.audioContext!.createMediaElementSource(video);
        audioSource.connect(this.masterGain!);
        
        const source: VideoSource = {
          id: clipId,
          url,
          videoElement: video,
          audioSource,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          frameRate: this.frameRate
        };
        
        this.videoSources.set(clipId, source);
        console.log('✅ Video loaded:', clipId, `${video.videoWidth}x${video.videoHeight}`, `${video.duration}s`);
        resolve(source);
      });
      
      video.addEventListener('error', (e) => {
        console.error('❌ Video load error:', e);
        reject(new Error('Failed to load video'));
      });
      
      video.src = url;
      video.load();
    });
  }
  
  /**
   * Set timeline configuration
   */
  setTimeline(clips: BeatClip[], tracks: Track[], duration: number) {
    this.clips = clips;
    this.tracks = tracks;
    this.duration = duration;
    
    console.log('📊 Timeline updated:', clips.length, 'clips,', tracks.length, 'tracks', duration, 'seconds');
  }
  
  /**
   * Get clip at specific time
   */
  private getActiveClip(time: number): BeatClip | null {
    return this.clips.find(clip => 
      time >= clip.start && time < (clip.start + clip.duration)
    ) || null;
  }
  
  /**
   * Render current frame to canvas
   */
  private renderFrame(time: number) {
    if (!this.canvas || !this.ctx) return;
    
    // Clear canvas
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Get active clip at current time
    const activeClip = this.getActiveClip(time);
    
    if (activeClip) {
      const source = this.videoSources.get(activeClip.id);
      
      if (source && source.videoElement) {
        // Calculate local time within clip (accounting for in/out points)
        const localTime = time - activeClip.start + (activeClip.metadata?.inPoint || 0);
        
        // Sync video element to local time
        if (Math.abs(source.videoElement.currentTime - localTime) > 0.1) {
          source.videoElement.currentTime = localTime;
        }
        
        // Draw video frame to canvas
        try {
          this.ctx.drawImage(
            source.videoElement,
            0, 0,
            this.canvas.width, this.canvas.height
          );
        } catch (e) {
          console.warn('Frame draw failed:', e);
        }
        
        // Draw overlay info (beat name, timecode)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 10, 300, 60);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '14px monospace';
        this.ctx.fillText(`Beat: ${activeClip.beatName}`, 20, 30);
        this.ctx.fillText(`Timecode: ${this.formatTimecode(time)}`, 20, 50);
      }
    } else {
      // No clip active - show black with timecode
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '20px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(this.formatTimecode(time), this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.textAlign = 'left';
    }
    
    // Notify listeners
    if (this.onFrame) {
      const frame = Math.floor(time * this.frameRate);
      this.onFrame(time, frame);
    }
  }
  
  /**
   * Animation loop for smooth playback
   */
  private tick = (timestamp: number) => {
    if (!this.isPlaying) return;
    
    // Calculate delta time
    const deltaTime = this.lastFrameTime ? (timestamp - this.lastFrameTime) / 1000 : 0;
    this.lastFrameTime = timestamp;
    
    // Update current time
    this.currentTime += deltaTime * this.playbackRate;
    
    // Handle looping
    if (this.currentTime > this.duration) {
      if (this.isLooping) {
        this.currentTime = 0;
      } else {
        this.currentTime = this.duration;
        this.pause();
        return;
      }
    }
    
    if (this.currentTime < 0) {
      if (this.isLooping) {
        this.currentTime = this.duration;
      } else {
        this.currentTime = 0;
        this.pause();
        return;
      }
    }
    
    // Render frame
    this.renderFrame(this.currentTime);
    
    // Notify time update
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime);
    }
    
    // Continue animation
    this.animationFrameId = requestAnimationFrame(this.tick);
  };
  
  /**
   * Start playback
   */
  async play() {
    if (this.isPlaying) return;
    
    // Resume audio context (user gesture requirement)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    
    // Start video playback for active clip
    const activeClip = this.getActiveClip(this.currentTime);
    if (activeClip) {
      const source = this.videoSources.get(activeClip.id);
      if (source?.videoElement) {
        source.videoElement.playbackRate = this.playbackRate;
        await source.videoElement.play().catch(e => console.warn('Video play failed:', e));
      }
    }
    
    this.animationFrameId = requestAnimationFrame(this.tick);
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(true);
    }
    
    console.log('▶️  Playback started');
  }
  
  /**
   * Pause playback
   */
  pause() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    
    // Pause all videos
    this.videoSources.forEach(source => {
      if (source.videoElement) {
        source.videoElement.pause();
      }
    });
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(false);
    }
    
    console.log('⏸️  Playback paused');
  }
  
  /**
   * Stop playback and reset to beginning
   */
  stop() {
    this.pause();
    this.seek(0);
    console.log('⏹️  Playback stopped');
  }
  
  /**
   * Seek to specific time
   */
  seek(time: number) {
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    this.renderFrame(this.currentTime);
    
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime);
    }
  }
  
  /**
   * Step one frame forward
   */
  stepForward() {
    this.seek(this.currentTime + this.frameTime);
  }
  
  /**
   * Step one frame backward
   */
  stepBackward() {
    this.seek(this.currentTime - this.frameTime);
  }
  
  /**
   * Set playback rate
   */
  setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.1, Math.min(8, rate));
    
    // Update active video element
    const activeClip = this.getActiveClip(this.currentTime);
    if (activeClip) {
      const source = this.videoSources.get(activeClip.id);
      if (source?.videoElement) {
        source.videoElement.playbackRate = this.playbackRate;
      }
    }
  }
  
  /**
   * Set looping
   */
  setLooping(loop: boolean) {
    this.isLooping = loop;
  }
  
  /**
   * Set volume
   */
  setVolume(volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
  
  /**
   * Get current playback state
   */
  getState(): PlaybackState {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      playbackRate: this.playbackRate,
      direction: 'forward',
      isLooping: this.isLooping
    };
  }
  
  /**
   * Format time as timecode (HH:MM:SS:FF)
   */
  formatTimecode(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * this.frameRate);
    
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  }
  
  /**
   * Set callbacks
   */
  setCallbacks(callbacks: {
    onTimeUpdate?: (time: number) => void;
    onPlayStateChange?: (isPlaying: boolean) => void;
    onFrame?: (time: number, frame: number) => void;
  }) {
    this.onTimeUpdate = callbacks.onTimeUpdate;
    this.onPlayStateChange = callbacks.onPlayStateChange;
    this.onFrame = callbacks.onFrame;
  }
  
  /**
   * Get current frame number
   */
  getCurrentFrame(): number {
    return Math.floor(this.currentTime * this.frameRate);
  }
  
  /**
   * Seek to specific frame
   */
  seekToFrame(frame: number) {
    this.seek(frame / this.frameRate);
  }
  
  /**
   * Get audio levels (for VU meters)
   */
  getAudioLevels(): { left: number; right: number } {
    // TODO: Add AnalyserNode for real levels
    return { left: -20, right: -20 };
  }
  
  /**
   * Cleanup
   */
  destroy() {
    this.pause();
    
    // Stop all videos
    this.videoSources.forEach(source => {
      if (source.videoElement) {
        source.videoElement.pause();
        source.videoElement.src =', ';
        source.videoElement.load();
      }
      if (source.audioSource) {
        source.audioSource.disconnect();
      }
    });
    
    this.videoSources.clear();
    
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    console.log('🧹 VideoPlaybackEngine destroyed');
  }
}

// Singleton instance
export const videoEngine = new VideoPlaybackEngine();


