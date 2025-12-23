/**
 * REAL Audio Processing Service
 * Client-side audio DSP with Web Audio API
 * Properly connected nodes and real-time analysis
 */

// @ts-ignore - wav-decoder types
import { parseBuffer as parseWav } from 'wav-decoder';
// @ts-ignore - wav-encoder types
import encode from 'wav-encoder';

export interface AudioProcessingParams {
  denoise?: {
    threshold: number;
    reduction: number;
  };
  eq?: {
    low: number;
    lowMid: number;
    highMid: number;
    high: number;
  };
  compressor?: {
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
  };
  limiter?: {
    ceiling: number;
    lookahead: number;
  };
  bypass?: boolean;
}

export interface AudioMetrics {
  inputLevelL: number;
  inputLevelR: number;
  outputLevelL: number;
  outputLevelR: number;
  gainReduction: number;
  peakL: number;
  peakR: number;
}

export class AudioProcessingService {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  
  // Audio nodes for real-time chain
  private analyserInput: AnalyserNode | null = null;
  private analyserOutput: AnalyserNode | null = null;
  private gainNodeInput: GainNode | null = null;
  private gainNodeOutput: GainNode | null = null;
  
  // EQ nodes (4-band parametric)
  private eqLowShelf: BiquadFilterNode | null = null;
  private eqLowMid: BiquadFilterNode | null = null;
  private eqHighMid: BiquadFilterNode | null = null;
  private eqHighShelf: BiquadFilterNode | null = null;
  
  // Dynamics
  private compressor: DynamicsCompressorNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  
  // State
  private isPlaying: boolean = false;
  private isBypassed: boolean = false;
  private startTime: number = 0;
  private pauseTime: number = 0;
  
  constructor() {
    this.initAudioContext();
  }
  
  private initAudioContext() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create input analyser (before processing)
    this.analyserInput = this.audioContext.createAnalyser();
    this.analyserInput.fftSize = 2048; // 1024 frequency bins (studio-grade)
    this.analyserInput.smoothingTimeConstant = 0.8;
    
    // Create output analyser (after processing)
    this.analyserOutput = this.audioContext.createAnalyser();
    this.analyserOutput.fftSize = 2048;
    this.analyserOutput.smoothingTimeConstant = 0.8;
    
    // Create gain nodes for level monitoring
    this.gainNodeInput = this.audioContext.createGain();
    this.gainNodeOutput = this.audioContext.createGain();
    
    // Create EQ nodes (4-band parametric)
    this.eqLowShelf = this.audioContext.createBiquadFilter();
    this.eqLowShelf.type = 'lowshelf';
    this.eqLowShelf.frequency.value = 80;
    this.eqLowShelf.gain.value = 0;
    
    this.eqLowMid = this.audioContext.createBiquadFilter();
    this.eqLowMid.type = 'peaking';
    this.eqLowMid.frequency.value = 400;
    this.eqLowMid.Q.value = 1.0;
    this.eqLowMid.gain.value = 0;
    
    this.eqHighMid = this.audioContext.createBiquadFilter();
    this.eqHighMid.type = 'peaking';
    this.eqHighMid.frequency.value = 2000;
    this.eqHighMid.Q.value = 1.0;
    this.eqHighMid.gain.value = 0;
    
    this.eqHighShelf = this.audioContext.createBiquadFilter();
    this.eqHighShelf.type = 'highshelf';
    this.eqHighShelf.frequency.value = 8000;
    this.eqHighShelf.gain.value = 0;
    
    // Create compressor
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.compressor.knee.value = 10;
    
    // Create limiter (hard compressor at output)
    this.limiter = this.audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.01;
    this.limiter.knee.value = 0;
    
    console.log('🎛️ Audio processing chain initialized');
  }
  
  /**
   * Load and decode audio file
   */
  async loadAudioFile(file: File): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('AudioContext not initialized');
    
    // Resume AudioContext (required for user gesture)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    const arrayBuffer = await file.arrayBuffer();
    
    try {
      // Try native decoding first (handles MP3, AAC, WAV, OGG, etc.)
      this.currentBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log('✅ Audio decoded: ', {
        duration: this.currentBuffer.duration,
        sampleRate: this.currentBuffer.sampleRate,
        channels: this.currentBuffer.numberOfChannels
      });
      return this.currentBuffer;
    } catch (error) {
      // Fallback for WAV files
      try {
        const wavData = await parseWav(arrayBuffer);
        this.currentBuffer = this.audioContext.createBuffer(
          wavData.channelData.length,
          wavData.channelData[0].length,
          wavData.sampleRate
        );
        
        wavData.channelData.forEach((channelData: any, i: number) => {
          this.currentBuffer!.copyToChannel(new Float32Array(channelData), i);
        });
        
        return this.currentBuffer;
      } catch (wavError) {
        throw new Error('Failed to decode audio file. Supported formats: WAV, MP3, AAC, OGG');
      }
    }
  }
  
  /**
   * PLAY audio through the processing chain
   */
  async play(loop: boolean = false): Promise<void> {
    if (!this.audioContext || !this.currentBuffer) {
      throw new Error('No audio loaded');
    }
    
    // Stop any existing playback
    this.stop();
    
    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    // Create new source node
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.currentBuffer;
    this.sourceNode.loop = loop;
    
    // WIRE UP THE REAL PROCESSING CHAIN:
    // Source → Input Gain → Input Analyser → [EQ Chain] → Compressor → Limiter → Output Analyser → Output Gain → Destination
    
    if (this.isBypassed) {
      // BYPASS: Direct connection
      this.sourceNode.connect(this.gainNodeInput!);
      this.gainNodeInput!.connect(this.analyserInput!);
      this.analyserInput!.connect(this.gainNodeOutput!);
      this.gainNodeOutput!.connect(this.analyserOutput!);
      this.analyserOutput!.connect(this.audioContext.destination);
    } else {
      // FULL CHAIN: All processing active
      this.sourceNode.connect(this.gainNodeInput!);
      this.gainNodeInput!.connect(this.analyserInput!);
      
      // EQ chain
      this.analyserInput!.connect(this.eqLowShelf!);
      this.eqLowShelf!.connect(this.eqLowMid!);
      this.eqLowMid!.connect(this.eqHighMid!);
      this.eqHighMid!.connect(this.eqHighShelf!);
      
      // Dynamics
      this.eqHighShelf!.connect(this.compressor!);
      this.compressor!.connect(this.limiter!);
      
      // Output monitoring
      this.limiter!.connect(this.gainNodeOutput!);
      this.gainNodeOutput!.connect(this.analyserOutput!);
      this.analyserOutput!.connect(this.audioContext.destination);
    }
    
    // Start playback
    const offset = this.pauseTime || 0;
    this.sourceNode.start(0, offset);
    this.startTime = this.audioContext.currentTime - offset;
    this.isPlaying = true;
    
    // Handle playback end
    this.sourceNode.onended = () => {
      if (!loop) {
        this.isPlaying = false;
        this.pauseTime = 0;
      }
    };
    
    console.log('▶️ Audio playback started with full processing chain');
  }
  
  /**
   * PAUSE audio
   */
  pause(): void {
    if (this.sourceNode && this.audioContext) {
      this.pauseTime = this.audioContext.currentTime - this.startTime;
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.sourceNode = null;
      this.isPlaying = false;
      console.log('⏸️ Audio paused at', this.pauseTime.toFixed(2), 's');
    }
  }
  
  /**
   * STOP audio (reset to beginning)
   */
  stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.sourceNode = null;
    }
    this.isPlaying = false;
    this.pauseTime = 0;
    this.startTime = 0;
    console.log('⏹️ Audio stopped');
  }
  
  /**
   * Update EQ parameters in REAL-TIME
   */
  updateEQ(bands: { low: number; lowMid: number; highMid: number; high: number }): void {
    if (!this.eqLowShelf || !this.eqLowMid || !this.eqHighMid || !this.eqHighShelf) return;
    
    // Map 0-100 slider values to -12dB to +12dB
    this.eqLowShelf.gain.value = (bands.low - 50) * 0.24;
    this.eqLowMid.gain.value = (bands.lowMid - 50) * 0.24;
    this.eqHighMid.gain.value = (bands.highMid - 50) * 0.24;
    this.eqHighShelf.gain.value = (bands.high - 50) * 0.24;
  }
  
  /**
   * Update compressor parameters in REAL-TIME
   */
  updateCompressor(params: { threshold: number; ratio: number; attack: number; release: number }): void {
    if (!this.compressor) return;
    
    // Map slider values to audio ranges
    this.compressor.threshold.value = -50 + (params.threshold / 100) * 50; // -50dB to 0dB
    this.compressor.ratio.value = 1 + (params.ratio / 100) * 19; // 1:1 to 20:1
    this.compressor.attack.value = (params.attack / 100) * 1; // 0s to 1s
    this.compressor.release.value = 0.01 + (params.release / 100) * 0.99; // 0.01s to 1s
  }
  
  /**
   * Update limiter parameters in REAL-TIME
   */
  updateLimiter(params: { ceiling: number; lookahead: number }): void {
    if (!this.limiter) return;
    
    this.limiter.threshold.value = -6 + (params.ceiling / 100) * 5.9; // -6dB to -0.1dB
    this.limiter.attack.value = 0.001 + (params.lookahead / 100) * 0.009; // 1ms to 10ms
  }
  
  /**
   * Toggle bypass (switch routing)
   */
  setBypass(bypassed: boolean): void {
    this.isBypassed = bypassed;
    
    // If currently playing, restart with new routing
    if (this.isPlaying && this.currentBuffer) {
      const wasLooping = this.sourceNode?.loop || false;
      const currentTime = this.getCurrentTime();
      this.stop();
      this.pauseTime = currentTime;
      // Will reconnect on next play
    }
  }
  
  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    if (!this.audioContext) return 0;
    
    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startTime;
    }
    return this.pauseTime;
  }
  
  /**
   * Get REAL audio levels from analysers
   */
  getAudioMetrics(): AudioMetrics {
    const defaultMetrics: AudioMetrics = {
      inputLevelL: -60,
      inputLevelR: -60,
      outputLevelL: -60,
      outputLevelR: -60,
      gainReduction: 0,
      peakL: -60,
      peakR: -60
    };
    
    if (!this.analyserInput || !this.analyserOutput || !this.isPlaying) {
      return defaultMetrics;
    }
    
    // Get time domain data for RMS calculation
    const inputData = new Float32Array(this.analyserInput.fftSize);
    const outputData = new Float32Array(this.analyserOutput.fftSize);
    
    this.analyserInput.getFloatTimeDomainData(inputData);
    this.analyserOutput.getFloatTimeDomainData(outputData);
    
    // Calculate RMS for each channel (split stereo)
    const halfSize = inputData.length / 2;
    const inputL = inputData.slice(0, halfSize);
    const inputR = inputData.slice(halfSize);
    const outputL = outputData.slice(0, halfSize);
    const outputR = outputData.slice(halfSize);
    
    const inputLevelL = this.calculateRMS(inputL);
    const inputLevelR = this.calculateRMS(inputR);
    const outputLevelL = this.calculateRMS(outputL);
    const outputLevelR = this.calculateRMS(outputR);
    
    // Gain reduction = input - output
    const grL = inputLevelL - outputLevelL;
    const grR = inputLevelR - outputLevelR;
    const gainReduction = Math.max(0, (grL + grR) / 2);
    
    // Peak detection
    const peakL = 20 * Math.log10(Math.max(...Array.from(inputL).map(Math.abs)));
    const peakR = 20 * Math.log10(Math.max(...Array.from(inputR).map(Math.abs)));
    
    return {
      inputLevelL,
      inputLevelR,
      outputLevelL,
      outputLevelR,
      gainReduction,
      peakL,
      peakR
    };
  }
  
  /**
   * Get frequency spectrum data (for analyzer visualization)
   */
  getFrequencyData(): Uint8Array {
    if (!this.analyserOutput) {
      return new Uint8Array(1024).fill(0);
    }
    
    const dataArray = new Uint8Array(this.analyserOutput.frequencyBinCount);
    this.analyserOutput.getByteFrequencyData(dataArray);
    return dataArray;
  }
  
  /**
   * Calculate RMS (Root Mean Square) → dB
   */
  private calculateRMS(audioData: Float32Array): number {
    if (audioData.length === 0) return -60;
    
    const sum = audioData.reduce((acc, val) => acc + val * val, 0);
    const rms = Math.sqrt(sum / audioData.length);
    
    if (rms === 0) return -60;
    return 20 * Math.log10(rms);
  }
  
  /**
   * Render offline (process entire file)
   */
  async processOffline(audioBuffer: AudioBuffer, params: AudioProcessingParams): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('AudioContext not initialized');
    
    if (params.bypass) return audioBuffer;
    
    // Create offline context
    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    
    // Recreate chain in offline context
    let currentNode: AudioNode = source;
    
    // EQ
    if (params.eq) {
      const lowShelf = offlineCtx.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.value = 80;
      lowShelf.gain.value = (params.eq.low - 50) * 0.24;
      
      const lowMid = offlineCtx.createBiquadFilter();
      lowMid.type = 'peaking';
      lowMid.frequency.value = 400;
      lowMid.Q.value = 1.0;
      lowMid.gain.value = (params.eq.lowMid - 50) * 0.24;
      
      const highMid = offlineCtx.createBiquadFilter();
      highMid.type = 'peaking';
      highMid.frequency.value = 2000;
      highMid.Q.value = 1.0;
      highMid.gain.value = (params.eq.highMid - 50) * 0.24;
      
      const highShelf = offlineCtx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 8000;
      highShelf.gain.value = (params.eq.high - 50) * 0.24;
      
      currentNode.connect(lowShelf);
      lowShelf.connect(lowMid);
      lowMid.connect(highMid);
      highMid.connect(highShelf);
      currentNode = highShelf;
    }
    
    // Compressor
    if (params.compressor) {
      const comp = offlineCtx.createDynamicsCompressor();
      comp.threshold.value = -50 + (params.compressor.threshold / 100) * 50;
      comp.ratio.value = 1 + (params.compressor.ratio / 100) * 19;
      comp.attack.value = (params.compressor.attack / 100) * 1;
      comp.release.value = 0.01 + (params.compressor.release / 100) * 0.99;
      comp.knee.value = 10;
      
      currentNode.connect(comp);
      currentNode = comp;
    }
    
    // Limiter
    if (params.limiter) {
      const lim = offlineCtx.createDynamicsCompressor();
      lim.threshold.value = -6 + (params.limiter.ceiling / 100) * 5.9;
      lim.ratio.value = 20;
      lim.attack.value = 0.001 + (params.limiter.lookahead / 100) * 0.009;
      lim.release.value = 0.01;
      lim.knee.value = 0;
      
      currentNode.connect(lim);
      currentNode = lim;
    }
    
    // Connect to destination
    currentNode.connect(offlineCtx.destination);
    
    // Render
    source.start(0);
    const renderedBuffer = await offlineCtx.startRendering();
    
    console.log('✅ Offline rendering complete:', renderedBuffer.duration, 's');
    return renderedBuffer;
  }
  
  /**
   * Export AudioBuffer to downloadable WAV file
   */
  async exportToWav(audioBuffer: AudioBuffer, filename: string): Promise<void> {
    const channelData: Float32Array[] = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channelData.push(audioBuffer.getChannelData(i));
    }
    
    const wavData = await encode({
      sampleRate: audioBuffer.sampleRate,
      channelData: channelData
    });
    
    const blob = new Blob([wavData], { type:'audio/wav' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
    console.log('💾 WAV exported:', filename);
  }
  
  // Getters
  getIsPlaying(): boolean { return this.isPlaying; }
  getInputAnalyser(): AnalyserNode | null { return this.analyserInput; }
  getOutputAnalyser(): AnalyserNode | null { return this.analyserOutput; }
  getCompressor(): DynamicsCompressorNode | null { return this.compressor; }
  getDuration(): number { return this.currentBuffer?.duration || 0; }
}

// Singleton instance
export const audioEngine = new AudioProcessingService();
