// @ts-nocheck
/**
 * HLS STREAMING SERVICE
 * Stream from YouTube, Vimeo, cloud sources
 * Using hls.js for adaptive streaming (with Safari native fallback)
 */

import Hls from 'hls.js';

export class HLSStreamingService {
  private hls: Hls | null = null;

  /**
   * Check HLS support
   */
  static isSupported(): boolean {
    // hls.js covers most browsers; Safari supports native HLS.
    if (typeof document === 'undefined') return false;
    if (Hls.isSupported()) return true;
    const video = document.createElement('video');
    return video.canPlayType('application/vnd.apple.mpegurl') !== ',';
  }
  
  /**
   * Load HLS stream
   */
  loadStream(videoElement: HTMLVideoElement, url: string) {
    // Tear down any previous instance
    this.destroy();

    // Use hls.js when supported (most browsers).
    if (Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });

      this.hls.loadSource(url);
      this.hls.attachMedia(videoElement);

      this.hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        console.log('✅ HLS manifest loaded:', {
          levels: data?.levels?.length ?? 0,
        });
      });

      this.hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data?.fatal) return;

        console.error('❌ Fatal HLS error:', data);
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log('🔄 Trying to recover network error...');
            this.hls?.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('🔄 Trying to recover media error...');
            this.hls?.recoverMediaError();
            break;
          default:
            console.error('💥 Cannot recover from error');
            this.destroy();
            break;
        }
      });

      console.log('✅ HLS stream loading (hls.js):', url);
      return;
    }

    // Fallback for Safari (native HLS)
    if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = url;
      console.log('✅ Using native HLS (Safari)');
      return;
    }

    console.error('❌ HLS not supported in this browser');
  }
  
  /**
   * Get available quality levels
   */
  getQualityLevels(): Array<{ index: number; height: number; bitrate: number }> {
    if (!this.hls) return [];

    return this.hls.levels.map((level, index) => ({
      index,
      height: level.height,
      bitrate: level.bitrate,
    }));
  }
  
  /**
   * Switch quality level
   */
  setQualityLevel(levelIndex: number) {
    if (!this.hls) return;
    this.hls.currentLevel = levelIndex;
    console.log(`🎬 Switched to quality level ${levelIndex}`);
  }
  
  /**
   * Enable auto quality selection
   */
  setAutoQuality() {
    if (!this.hls) return;
    this.hls.currentLevel = -1; // Auto
    console.log('🔄 Auto quality enabled');
  }
  
  /**
   * Get current stats
   */
  getStats(): {
    currentLevel: number;
    bandwidth: number;
    droppedFrames: number;
  } | null {
    if (!this.hls) return null;

    return {
      currentLevel: this.hls.currentLevel,
      bandwidth: this.hls.bandwidthEstimate,
      droppedFrames: (this.hls as any).media?.webkitDroppedFrameCount || 0,
    };
  }
  
  /**
   * Cleanup
   */
  destroy() {
    if (!this.hls) return;
    this.hls.destroy();
    this.hls = null;
    console.log('🗑️ HLS destroyed');
  }
}


