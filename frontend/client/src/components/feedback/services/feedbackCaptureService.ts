/**
 * FeedbackCaptureService - Screenshot, Audio, Video, and Context Capture
 * 
 * Features:
 * - Screenshot capture with html2canvas
 * - Audio recording with MediaRecorder
 * - Screen recording with getDisplayMedia
 * - Browser/device context detection
 * - Performance metrics capture
 * - Console error tracking
 * - User journey tracking
 */

import html2canvas from 'html2canvas';

// ============================================================================
// Types
// ============================================================================

export interface ScreenshotResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  timestamp: number;
}

export interface AudioRecordingResult {
  blob: Blob;
  duration: number;
  mimeType: string;
  timestamp: number;
}

export interface VideoRecordingResult {
  blob: Blob;
  duration: number;
  mimeType: string;
  width: number;
  height: number;
  timestamp: number;
}

export interface BrowserContext {
  userAgent: string;
  platform: string;
  language: string;
  viewport: { width: number; height: number };
  screenSize: { width: number; height: number };
  devicePixelRatio: number;
  colorDepth: number;
  timezone: string;
  online: boolean;
  cookiesEnabled: boolean;
  doNotTrack: boolean;
  touchSupported: boolean;
  webGL: string | null;
}

export interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  memoryUsage: number | null;
  fps: number;
}

export interface ConsoleError {
  message: string;
  source: string;
  lineno: number;
  colno: number;
  timestamp: number;
  stack?: string;
}

export interface UserJourneyStep {
  type: 'navigation' | 'click' | 'input' | 'scroll' | 'error';
  target?: string;
  value?: string;
  url: string;
  timestamp: number;
}

export interface FeedbackContext {
  browser: BrowserContext;
  performance: PerformanceMetrics;
  consoleErrors: ConsoleError[];
  userJourney: UserJourneyStep[];
  currentUrl: string;
  currentComponent: string | null;
  sessionDuration: number;
}

// ============================================================================
// Screenshot Capture
// ============================================================================

class ScreenshotService {
  async capture(
    element?: HTMLElement,
    options?: {
      scale?: number;
      backgroundColor?: string;
      ignoreElements?: string[];
    }
  ): Promise<ScreenshotResult> {
    const target = element || document.body;
    const scale = options?.scale || window.devicePixelRatio;

    const canvas = await html2canvas(target, {
      scale,
      backgroundColor: options?.backgroundColor || null,
      logging: false,
      useCORS: true,
      allowTaint: true,
      ignoreElements: (el) => {
        // Ignore the feedback tool itself
        if (el.classList.contains('prototype-feedback-tool')) return true;
        // Ignore specified elements
        if (options?.ignoreElements?.some(selector => el.matches(selector))) return true;
        return false;
      },
    });

    const dataUrl = canvas.toDataURL('image/png');
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });

    return {
      dataUrl,
      blob,
      width: canvas.width,
      height: canvas.height,
      timestamp: Date.now(),
    };
  }

  async captureWithHighlight(
    highlightElement: HTMLElement,
    options?: { padding?: number; borderColor?: string }
  ): Promise<ScreenshotResult> {
    const padding = options?.padding || 20;
    const borderColor = options?.borderColor || '#f44336';

    // Add highlight overlay
    const rect = highlightElement.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: ${rect.top - padding}px;
      left: ${rect.left - padding}px;
      width: ${rect.width + padding * 2}px;
      height: ${rect.height + padding * 2}px;
      border: 3px solid ${borderColor};
      border-radius: 4px;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      z-index: 99999;
    `;
    document.body.appendChild(overlay);

    try {
      const result = await this.capture();
      return result;
    } finally {
      overlay.remove();
    }
  }

  createAnnotationCanvas(screenshot: ScreenshotResult): {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    tools: AnnotationTools;
  } {
    const canvas = document.createElement('canvas');
    canvas.width = screenshot.width;
    canvas.height = screenshot.height;
    const ctx = canvas.getContext('2d')!;

    // Draw screenshot as background
    const img = new Image();
    img.src = screenshot.dataUrl;
    img.onload = () => ctx.drawImage(img, 0, 0);

    const tools: AnnotationTools = {
      drawArrow: (from, to, color = '#f44336') => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        // Arrow head
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        ctx.lineTo(to.x - 15 * Math.cos(angle - Math.PI / 6), to.y - 15 * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - 15 * Math.cos(angle + Math.PI / 6), to.y - 15 * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      },
      drawRect: (rect, color = '#f44336') => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      },
      drawCircle: (center, radius, color = '#f44336') => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      },
      drawText: (position, text, color = '#f44336', fontSize = 16) => {
        ctx.fillStyle = color;
        ctx.font = `${fontSize}px Arial`;
        ctx.fillText(text, position.x, position.y);
      },
      highlight: (rect, color = 'rgba(255, 235, 59, 0.3)') => {
        ctx.fillStyle = color;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      },
      blur: (rect) => {
        const imageData = ctx.getImageData(rect.x, rect.y, rect.width, rect.height);
        // Simple box blur
        for (let i = 0; i < 3; i++) {
          this.boxBlur(imageData);
        }
        ctx.putImageData(imageData, rect.x, rect.y);
      },
      undo: () => {
        // Would need history stack
      },
      export: () => canvas.toDataURL('image/png'),
    };

    return { canvas, ctx, tools };
  }

  private boxBlur(imageData: ImageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const kernel = 5;
    const half = Math.floor(kernel / 2);

    for (let y = half; y < height - half; y++) {
      for (let x = half; x < width - half; x++) {
        let r = 0, g = 0, b = 0;
        for (let ky = -half; ky <= half; ky++) {
          for (let kx = -half; kx <= half; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
          }
        }
        const count = kernel * kernel;
        const idx = (y * width + x) * 4;
        data[idx] = r / count;
        data[idx + 1] = g / count;
        data[idx + 2] = b / count;
      }
    }
  }
}

interface AnnotationTools {
  drawArrow: (from: { x: number; y: number }, to: { x: number; y: number }, color?: string) => void;
  drawRect: (rect: { x: number; y: number; width: number; height: number }, color?: string) => void;
  drawCircle: (center: { x: number; y: number }, radius: number, color?: string) => void;
  drawText: (position: { x: number; y: number }, text: string, color?: string, fontSize?: number) => void;
  highlight: (rect: { x: number; y: number; width: number; height: number }, color?: string) => void;
  blur: (rect: { x: number; y: number; width: number; height: number }) => void;
  undo: () => void;
  export: () => string;
}

// ============================================================================
// Audio Recording
// ============================================================================

class AudioRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(100); // Collect data every 100ms
  }

  async stop(): Promise<AudioRecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: this.mediaRecorder!.mimeType });
        const duration = Date.now() - this.startTime;

        // Stop all tracks
        this.stream?.getTracks().forEach(track => track.stop());
        
        resolve({
          blob,
          duration,
          mimeType: this.mediaRecorder!.mimeType,
          timestamp: this.startTime,
        });
      };

      this.mediaRecorder.stop();
    });
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  getElapsedTime(): number {
    if (!this.startTime || !this.isRecording()) return 0;
    return Date.now() - this.startTime;
  }

  // Transcribe audio using Web Speech API
  async transcribe(audioBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        reject(new Error('Speech recognition not supported'));
        return;
      }

      // Create audio element and play for recognition
      const audio = new Audio(URL.createObjectURL(audioBlob));
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = navigator.language;

      let transcript = ', ';

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
      };

      recognition.onend = () => resolve(transcript);
      recognition.onerror = (e: any) => reject(e);

      audio.onplay = () => recognition.start();
      audio.onended = () => recognition.stop();
      audio.play();
    });
  }
}

// ============================================================================
// Video/Screen Recording
// ============================================================================

class VideoRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private videoChunks: Blob[] = [];
  private startTime: number = 0;
  private stream: MediaStream | null = null;

  async startScreenRecording(options?: {
    audio?: boolean;
    cursor?: 'always' | 'motion' | 'never';
  }): Promise<void> {
    this.videoChunks = [];

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: options?.cursor || 'always',
      },
      audio: options?.audio,
    });

    // Optionally add microphone audio
    if (options?.audio) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = audioStream.getAudioTracks()[0];
        displayStream.addTrack(audioTrack);
      } catch (e) {
        console.warn('Could not add microphone audio: ', e);
      }
    }

    this.stream = displayStream;
    
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    this.mediaRecorder = new MediaRecorder(displayStream, { mimeType });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.videoChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(100);

    // Handle user stopping share
    displayStream.getVideoTracks()[0].onended = () => {
      this.stop();
    };
  }

  async startWebcamRecording(): Promise<void> {
    this.videoChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9' : 'video/webm';

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.videoChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(100);
  }

  async stop(): Promise<VideoRecordingResult | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.videoChunks, { type: this.mediaRecorder!.mimeType });
        const duration = Date.now() - this.startTime;

        // Get video dimensions
        const video = document.createElement('video');
        video.src = URL.createObjectURL(blob);
        video.onloadedmetadata = () => {
          resolve({
            blob,
            duration,
            mimeType: this.mediaRecorder!.mimeType,
            width: video.videoWidth,
            height: video.videoHeight,
            timestamp: this.startTime,
          });
        };

        // Stop all tracks
        this.stream?.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.stop();
    });
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  getElapsedTime(): number {
    if (!this.startTime || !this.isRecording()) return 0;
    return Date.now() - this.startTime;
  }
}

// ============================================================================
// Context Detection
// ============================================================================

class ContextDetectionService {
  private consoleErrors: ConsoleError[] = [];
  private userJourney: UserJourneyStep[] = [];
  private sessionStart: number = Date.now();
  private originalConsoleError: typeof console.error;
  private isTracking = false;

  constructor() {
    this.originalConsoleError = console.error;
  }

  startTracking(): void {
    if (this.isTracking) return;
    this.isTracking = true;
    this.sessionStart = Date.now();

    // Track console errors
    console.error = (...args) => {
      this.consoleErrors.push({
        message: args.map(a => String(a)).join(', '),
        source: 'console',
        lineno: 0,
        colno: 0,
        timestamp: Date.now(),
      });
      this.originalConsoleError.apply(console, args);
    };

    // Track window errors
    window.addEventListener('error', this.handleError);
    window.addEventListener('unhandledrejection', this.handleRejection);

    // Track navigation
    window.addEventListener('popstate', this.handleNavigation);

    // Track clicks
    document.addEventListener('click', this.handleClick, true);

    // Track inputs
    document.addEventListener('input', this.handleInput, true);

    // Track scrolls (debounced)
    let scrollTimeout: NodeJS.Timeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => this.handleScroll(), 150);
    });
  }

  stopTracking(): void {
    if (!this.isTracking) return;
    this.isTracking = false;

    console.error = this.originalConsoleError;
    window.removeEventListener('error', this.handleError);
    window.removeEventListener('unhandledrejection', this.handleRejection);
    window.removeEventListener('popstate', this.handleNavigation);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('input', this.handleInput, true);
  }

  private handleError = (event: ErrorEvent) => {
    this.consoleErrors.push({
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      timestamp: Date.now(),
      stack: event.error?.stack,
    });
  };

  private handleRejection = (event: PromiseRejectionEvent) => {
    this.consoleErrors.push({
      message: String(event.reason),
      source: 'Promise rejection',
      lineno: 0,
      colno: 0,
      timestamp: Date.now(),
      stack: event.reason?.stack,
    });
  };

  private handleNavigation = () => {
    this.userJourney.push({
      type: 'navigation',
      url: window.location.href,
      timestamp: Date.now(),
    });
  };

  private handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const selector = this.getElementSelector(target);
    
    this.userJourney.push({
      type: 'click',
      target: selector,
      value: target.textContent?.slice(0, 50),
      url: window.location.href,
      timestamp: Date.now(),
    });

    // Keep only last 50 journey steps
    if (this.userJourney.length > 50) {
      this.userJourney = this.userJourney.slice(-50);
    }
  };

  private handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const selector = this.getElementSelector(target);

    this.userJourney.push({
      type: 'input',
      target: selector,
      value: target.type === 'password' ? '***': target.value?.slice(0, 20),
      url: window.location.href,
      timestamp: Date.now(),
    });
  };

  private handleScroll = () => {
    this.userJourney.push({
      type: 'scroll',
      value: `${window.scrollY}px`,
      url: window.location.href,
      timestamp: Date.now(),
    });
  };

  private getElementSelector(el: HTMLElement): string {
    if (el.id) return `#${el.id}`;
    if (el.className && typeof el.className === 'string') return `.${el.className.split(' ').join('.')}`;
    return el.tagName.toLowerCase();
  }

  getBrowserContext(): BrowserContext {
    const gl = document.createElement('canvas').getContext('webgl');
    const webGL = gl 
      ? gl.getParameter(gl.RENDERER) || gl.getParameter(gl.VENDOR)
      : null;

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      screenSize: {
        width: window.screen.width,
        height: window.screen.height,
      },
      devicePixelRatio: window.devicePixelRatio,
      colorDepth: window.screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      online: navigator.onLine,
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack === '1',
      touchSupported: 'ontouchstart' in window,
      webGL,
    };
  }

  getPerformanceMetrics(): PerformanceMetrics {
    const timing = performance.timing;
    const paint = performance.getEntriesByType('paint');
    const lcp = performance.getEntriesByType('largest-contentful-paint');

    // Calculate FPS
    let fps = 60;
    let lastTime = performance.now();
    let frames = 0;
    
    const measureFPS = () => {
      frames++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        fps = frames;
        frames = 0;
        lastTime = now;
      }
    };
    requestAnimationFrame(measureFPS);

    return {
      loadTime: timing.loadEventEnd - timing.navigationStart,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
      largestContentfulPaint: (lcp[lcp.length - 1] as any)?.startTime || 0,
      timeToInteractive: timing.domInteractive - timing.navigationStart,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || null,
      fps,
    };
  }

  getCurrentComponent(): string | null {
    // Try to detect React component from data attributes
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      // Look for data-component or similar attributes
      const componentAttr = activeElement.closest('[data-component]')?.getAttribute('data-component');
      if (componentAttr) return componentAttr;
    }

    // Fallback: parse URL path
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    return segments[segments.length - 1] || 'home';
  }

  getFullContext(): FeedbackContext {
    return {
      browser: this.getBrowserContext(),
      performance: this.getPerformanceMetrics(),
      consoleErrors: [...this.consoleErrors],
      userJourney: [...this.userJourney],
      currentUrl: window.location.href,
      currentComponent: this.getCurrentComponent(),
      sessionDuration: Date.now() - this.sessionStart,
    };
  }

  clearErrors(): void {
    this.consoleErrors = [];
  }

  clearJourney(): void {
    this.userJourney = [];
  }
}

// ============================================================================
// Exports
// ============================================================================

export const screenshotService = new ScreenshotService();
export const audioRecordingService = new AudioRecordingService();
export const videoRecordingService = new VideoRecordingService();
export const contextDetectionService = new ContextDetectionService();

// Start tracking on import
if (typeof window !=='undefined') {
  contextDetectionService.startTracking();
}

export default {
  screenshot: screenshotService,
  audio: audioRecordingService,
  video: videoRecordingService,
  context: contextDetectionService,
};

