/**
 * TRANSITION EFFECTS ENGINE
 * Real transition rendering for video editor
 * Crossfades, dissolves, wipes, zooms, slides (like CapCut)
 */

export type TransitionType = 
  // Basic
  | 'cut'           // Instant cut (no transition)
  | 'crossfade'     // Cross dissolve
  | 'fade_black'    // Fade through black
  | 'fade_white'    // Fade through white
  // Wipe
  | 'wipe_left'     // Wipe from left
  | 'wipe_right'    // Wipe from right
  | 'wipe_up'       // Wipe up
  | 'wipe_down'     // Wipe down
  | 'wipe_diagonal' // Diagonal wipe
  | 'clock_wipe'    // Radial clock wipe
  | 'iris_in'       // Circular iris in
  | 'iris_out'      // Circular iris out
  // Slide & Push
  | 'slide_left'    // Slide left
  | 'slide_right'   // Slide right
  | 'slide_up'      // Slide up
  | 'slide_down'    // Slide down
  | 'push_left'     // Push left
  | 'push_right'    // Push right
  // Zoom & Rotate
  | 'zoom_in'       // Zoom in transition
  | 'zoom_out'      // Zoom out transition
  | 'rotate_left'   // Rotate left
  | 'rotate_right'  // Rotate right
  | 'flip_horizontal' // Horizontal flip
  | 'flip_vertical'   // Vertical flip
  // Effects
  | 'blur'          // Blur transition
  | 'radial_blur'   // Radial motion blur
  | 'directional_blur' // Directional blur
  | 'pixelate'      // Pixelate transition
  | 'glitch'        // Glitch effect
  | 'rgb_split'     // RGB channel split
  | 'venetian_blinds' // Venetian blinds
  | 'checkerboard'  // Checkerboard reveal
  | 'swap'          // Swap positions
  | 'cube_left'     // 3D cube rotate left
  | 'cube_right'    // 3D cube rotate right
  | 'page_curl';    // Page curl effect

export interface Transition {
  id: string;
  type: TransitionType;
  duration: number; // Seconds
  position: number; // Timeline position
  fromClipId: string;
  toClipId: string;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

class TransitionEffectsEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  
  /**
   * Initialize with canvas
   */
  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
  }
  
  /**
   * Render transition between two video frames
   */
  renderTransition(
    fromFrame: HTMLVideoElement | HTMLCanvasElement,
    toFrame: HTMLVideoElement | HTMLCanvasElement,
    transition: Transition,
    progress: number // 0-1
  ) {
    if (!this.canvas || !this.ctx) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Apply easing
    const easedProgress = this.applyEasing(progress, transition.easing);
    
    // Render based on transition type
    switch (transition.type) {
      case 'cut':
        this.renderCut(fromFrame, toFrame, easedProgress);
        break;
      case 'crossfade':
        this.renderCrossfade(fromFrame, toFrame, easedProgress);
        break;
      case 'fade_black':
        this.renderFadeThrough(fromFrame, toFrame, easedProgress, '#000000');
        break;
      case 'fade_white':
        this.renderFadeThrough(fromFrame, toFrame, easedProgress, '#ffffff');
        break;
      case 'wipe_left':
        this.renderWipe(fromFrame, toFrame, easedProgress, 'left');
        break;
      case 'wipe_right':
        this.renderWipe(fromFrame, toFrame, easedProgress, 'right');
        break;
      case 'wipe_up':
        this.renderWipe(fromFrame, toFrame, easedProgress, 'up');
        break;
      case 'wipe_down':
        this.renderWipe(fromFrame, toFrame, easedProgress, 'down');
        break;
      case 'slide_left':
        this.renderSlide(fromFrame, toFrame, easedProgress, 'left');
        break;
      case 'slide_right':
        this.renderSlide(fromFrame, toFrame, easedProgress, 'right');
        break;
      case 'zoom_in':
        this.renderZoom(fromFrame, toFrame, easedProgress, 'in');
        break;
      case 'zoom_out':
        this.renderZoom(fromFrame, toFrame, easedProgress, 'out');
        break;
      case 'blur':
        this.renderBlur(fromFrame, toFrame, easedProgress);
        break;
      case 'pixelate':
        this.renderPixelate(fromFrame, toFrame, easedProgress);
        break;
      case 'glitch':
        this.renderGlitch(fromFrame, toFrame, easedProgress);
        break;
      case 'wipe_diagonal':
        this.renderWipeDiagonal(fromFrame, toFrame, easedProgress);
        break;
      case 'clock_wipe':
        this.renderClockWipe(fromFrame, toFrame, easedProgress);
        break;
      case 'iris_in':
        this.renderIris(fromFrame, toFrame, easedProgress, 'in');
        break;
      case 'iris_out':
        this.renderIris(fromFrame, toFrame, easedProgress, 'out');
        break;
      case 'slide_up':
        this.renderSlideVertical(fromFrame, toFrame, easedProgress, 'up');
        break;
      case 'slide_down':
        this.renderSlideVertical(fromFrame, toFrame, easedProgress, 'down');
        break;
      case 'push_left':
        this.renderPush(fromFrame, toFrame, easedProgress, 'left');
        break;
      case 'push_right':
        this.renderPush(fromFrame, toFrame, easedProgress, 'right');
        break;
      case 'rotate_left':
        this.renderRotate(fromFrame, toFrame, easedProgress, 'left');
        break;
      case 'rotate_right':
        this.renderRotate(fromFrame, toFrame, easedProgress, 'right');
        break;
      case 'flip_horizontal':
        this.renderFlip(fromFrame, toFrame, easedProgress, 'horizontal');
        break;
      case 'flip_vertical':
        this.renderFlip(fromFrame, toFrame, easedProgress, 'vertical');
        break;
      case 'radial_blur':
        this.renderRadialBlur(fromFrame, toFrame, easedProgress);
        break;
      case 'directional_blur':
        this.renderDirectionalBlur(fromFrame, toFrame, easedProgress);
        break;
      case 'rgb_split':
        this.renderRGBSplit(fromFrame, toFrame, easedProgress);
        break;
      case 'venetian_blinds':
        this.renderVenetianBlinds(fromFrame, toFrame, easedProgress);
        break;
      case 'checkerboard':
        this.renderCheckerboard(fromFrame, toFrame, easedProgress);
        break;
      case 'swap':
        this.renderSwap(fromFrame, toFrame, easedProgress);
        break;
      case 'cube_left':
        this.renderCube(fromFrame, toFrame, easedProgress, 'left');
        break;
      case 'cube_right':
        this.renderCube(fromFrame, toFrame, easedProgress, 'right');
        break;
      case 'page_curl':
        this.renderPageCurl(fromFrame, toFrame, easedProgress);
        break;
    }
  }
  
  /**
   * Cut (instant)
   */
  private renderCut(from: any, to: any, progress: number) {
    this.ctx!.drawImage(progress < 0.5 ? from : to, 0, 0, this.canvas!.width, this.canvas!.height);
  }
  
  /**
   * Crossfade / Dissolve
   */
  private renderCrossfade(from: any, to: any, progress: number) {
    // Draw from frame
    this.ctx!.globalAlpha = 1 - progress;
    this.ctx!.drawImage(from, 0, 0, this.canvas!.width, this.canvas!.height);
    
    // Draw to frame on top
    this.ctx!.globalAlpha = progress;
    this.ctx!.drawImage(to, 0, 0, this.canvas!.width, this.canvas!.height);
    
    this.ctx!.globalAlpha = 1;
  }
  
  /**
   * Fade through color (black/white)
   */
  private renderFadeThrough(from: any, to: any, progress: number, color: string) {
    if (progress < 0.5) {
      // Fade out from frame
      this.ctx!.globalAlpha = 1 - (progress * 2);
      this.ctx!.drawImage(from, 0, 0, this.canvas!.width, this.canvas!.height);
      this.ctx!.globalAlpha = 1;
      
      // Fade in color
      this.ctx!.fillStyle = color;
      this.ctx!.globalAlpha = progress * 2;
      this.ctx!.fillRect(0, 0, this.canvas!.width, this.canvas!.height);
      this.ctx!.globalAlpha = 1;
    } else {
      // Fade out color
      this.ctx!.fillStyle = color;
      this.ctx!.globalAlpha = 2 - (progress * 2);
      this.ctx!.fillRect(0, 0, this.canvas!.width, this.canvas!.height);
      this.ctx!.globalAlpha = 1;
      
      // Fade in to frame
      this.ctx!.globalAlpha = (progress - 0.5) * 2;
      this.ctx!.drawImage(to, 0, 0, this.canvas!.width, this.canvas!.height);
      this.ctx!.globalAlpha = 1;
    }
  }
  
  /**
   * Wipe transition
   */
  private renderWipe(from: any, to: any, progress: number, direction: 'left' | 'right' | 'up' | 'down') {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    
    // Draw from frame
    this.ctx!.drawImage(from, 0, 0, width, height);
    
    // Save context
    this.ctx!.save();
    
    // Create clipping path for wipe
    this.ctx!.beginPath();
    
    switch (direction) {
      case 'left':
        this.ctx!.rect(0, 0, width * progress, height);
        break;
      case 'right':
        this.ctx!.rect(width * (1 - progress), 0, width * progress, height);
        break;
      case 'up':
        this.ctx!.rect(0, 0, width, height * progress);
        break;
      case 'down':
        this.ctx!.rect(0, height * (1 - progress), width, height * progress);
        break;
    }
    
    this.ctx!.clip();
    
    // Draw to frame within clip
    this.ctx!.drawImage(to, 0, 0, width, height);
    
    // Restore context
    this.ctx!.restore();
  }
  
  /**
   * Slide transition
   */
  private renderSlide(from: any, to: any, progress: number, direction: 'left' | 'right') {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    
    if (direction === 'left') {
      // From frame slides left
      this.ctx!.drawImage(from, -width * progress, 0, width, height);
      // To frame slides in from right
      this.ctx!.drawImage(to, width * (1 - progress), 0, width, height);
    } else {
      // From frame slides right
      this.ctx!.drawImage(from, width * progress, 0, width, height);
      // To frame slides in from left
      this.ctx!.drawImage(to, -width * (1 - progress), 0, width, height);
    }
  }
  
  /**
   * Zoom transition
   */
  private renderZoom(from: any, to: any, progress: number, direction: 'in' | 'out') {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    
    if (direction === 'in') {
      // From frame zooms in (grows)
      const scale = 1 + progress;
      const x = -(width * (scale - 1)) / 2;
      const y = -(height * (scale - 1)) / 2;
      
      this.ctx!.globalAlpha = 1 - progress;
      this.ctx!.drawImage(from, x, y, width * scale, height * scale);
      this.ctx!.globalAlpha = 1;
      
      // To frame fades in
      this.ctx!.globalAlpha = progress;
      this.ctx!.drawImage(to, 0, 0, width, height);
      this.ctx!.globalAlpha = 1;
    } else {
      // From frame zooms out (shrinks)
      const scale = 1 - (progress * 0.5);
      const x = (width * (1 - scale)) / 2;
      const y = (height * (1 - scale)) / 2;
      
      this.ctx!.globalAlpha = 1 - progress;
      this.ctx!.drawImage(from, x, y, width * scale, height * scale);
      this.ctx!.globalAlpha = 1;
      
      // To frame fades in
      this.ctx!.globalAlpha = progress;
      this.ctx!.drawImage(to, 0, 0, width, height);
      this.ctx!.globalAlpha = 1;
    }
  }
  
  /**
   * Blur transition
   */
  private renderBlur(from: any, to: any, progress: number) {
    // Draw from frame with increasing blur
    if (progress < 0.5) {
      const blurAmount = progress * 40; // 0-20px blur
      this.ctx!.filter = `blur(${blurAmount}px)`;
      this.ctx!.drawImage(from, 0, 0, this.canvas!.width, this.canvas!.height);
      this.ctx!.filter = 'none';
    } else {
      const blurAmount = (1 - progress) * 40; // 20-0px blur
      this.ctx!.filter = `blur(${blurAmount}px)`;
      this.ctx!.drawImage(to, 0, 0, this.canvas!.width, this.canvas!.height);
      this.ctx!.filter = 'none';
    }
  }
  
  /**
   * Pixelate transition
   */
  private renderPixelate(from: any, to: any, progress: number) {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    
    if (progress < 0.5) {
      // Pixelate from frame
      const pixelSize = Math.floor(progress * 40) + 1;
      this.renderPixelated(from, pixelSize);
    } else {
      // Un-pixelate to frame
      const pixelSize = Math.floor((1 - progress) * 40) + 1;
      this.renderPixelated(to, pixelSize);
    }
  }
  
  /**
   * Glitch effect
   */
  private renderGlitch(from: any, to: any, progress: number) {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    
    // More glitch in the middle
    const glitchIntensity = Math.sin(progress * Math.PI);
    
    if (progress < 0.3) {
      // Show from frame with glitch
      this.ctx!.drawImage(from, 0, 0, width, height);
      this.applyGlitchEffect(glitchIntensity);
    } else if (progress > 0.7) {
      // Show to frame with glitch
      this.ctx!.drawImage(to, 0, 0, width, height);
      this.applyGlitchEffect(glitchIntensity);
    } else {
      // Mix both with heavy glitch
      this.ctx!.globalAlpha = 0.5;
      this.ctx!.drawImage(from, 0, 0, width, height);
      this.ctx!.drawImage(to, 0, 0, width, height);
      this.ctx!.globalAlpha = 1;
      this.applyGlitchEffect(glitchIntensity);
    }
  }
  
  /**
   * Helper: Apply pixelation effect
   */
  private renderPixelated(source: any, pixelSize: number) {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    
    // Draw small
    this.ctx!.drawImage(source, 0, 0, width / pixelSize, height / pixelSize);
    
    // Scale up (pixelated)
    this.ctx!.imageSmoothingEnabled = false;
    this.ctx!.drawImage(this.canvas!, 0, 0, width / pixelSize, height / pixelSize, 0, 0, width, height);
    this.ctx!.imageSmoothingEnabled = true;
  }
  
  /**
   * Helper: Apply glitch effect
   */
  private applyGlitchEffect(intensity: number) {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    
    // RGB shift
    const imageData = this.ctx!.getImageData(0, 0, width, height);
    const shift = Math.floor(intensity * 10);
    
    if (shift > 0) {
      // Shift red channel
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width - shift; x++) {
          const fromIndex = (y * width + x) * 4;
          const toIndex = (y * width + x + shift) * 4;
          imageData.data[toIndex] = imageData.data[fromIndex]; // Red
        }
      }
      
      this.ctx!.putImageData(imageData, 0, 0);
    }
    
    // Scan lines
    this.ctx!.fillStyle = `rgba(0, 0, 0, ${intensity * 0.1})`;
    for (let y = 0; y < height; y += 2) {
      this.ctx!.fillRect(0, y, width, 1);
    }
  }
  
  /**
   * Apply easing function
   */
  private applyEasing(t: number, easing: string): number {
    switch (easing) {
      case 'linear':
        return t;
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return t * (2 - t);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default:
        return t;
    }
  }
  
  /**
   * Diagonal wipe
   */
  private renderWipeDiagonal(from: any, to: any, progress: number) {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    
    this.ctx!.drawImage(from, 0, 0, width, height);
    
    this.ctx!.save();
    this.ctx!.beginPath();
    
    const diagonal = Math.sqrt(width * width + height * height);
    const currentDiag = diagonal * progress;
    
    this.ctx!.moveTo(0, 0);
    this.ctx!.lineTo(Math.min(currentDiag, width), 0);
    this.ctx!.lineTo(0, Math.min(currentDiag, height));
    this.ctx!.closePath();
    
    this.ctx!.clip();
    this.ctx!.drawImage(to, 0, 0, width, height);
    this.ctx!.restore();
  }
  
  /**
   * Clock wipe (radial)
   */
  private renderClockWipe(from: any, to: any, progress: number) {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    this.ctx!.drawImage(from, 0, 0, width, height);
    
    this.ctx!.save();
    this.ctx!.beginPath();
    this.ctx!.moveTo(centerX, centerY);
    
    const endAngle = (progress * Math.PI * 2) - (Math.PI / 2); // Start from top
    this.ctx!.arc(centerX, centerY, Math.max(width, height), -Math.PI / 2, endAngle);
    this.ctx!.closePath();
    this.ctx!.clip();
    
    this.ctx!.drawImage(to, 0, 0, width, height);
    this.ctx!.restore();
  }
  
  /**
   * Iris transition (circular)
   */
  private renderIris(from: any, to: any, progress: number, direction: 'in' | 'out') {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(width * width + height * height) / 2;
    
    if (direction === 'in') {
      // Iris closes (circular vignette in)
      this.ctx!.drawImage(from, 0, 0, width, height);
      
      this.ctx!.save();
      this.ctx!.beginPath();
      this.ctx!.arc(centerX, centerY, maxRadius * (1 - progress), 0, Math.PI * 2);
      this.ctx!.clip();
      this.ctx!.drawImage(from, 0, 0, width, height);
      this.ctx!.restore();
      
      // Draw to frame outside iris
      this.ctx!.globalCompositeOperation = 'destination-over';
      this.ctx!.drawImage(to, 0, 0, width, height);
      this.ctx!.globalCompositeOperation = 'source-over';
    } else {
      // Iris opens (circular reveal)
      this.ctx!.drawImage(from, 0, 0, width, height);
      
      this.ctx!.save();
      this.ctx!.beginPath();
      this.ctx!.arc(centerX, centerY, maxRadius * progress, 0, Math.PI * 2);
      this.ctx!.clip();
      this.ctx!.drawImage(to, 0, 0, width, height);
      this.ctx!.restore();
    }
  }
  
  /**
   * Slide vertical (up/down)
   */
  private renderSlideVertical(from: any, to: any, progress: number, direction: 'up' | 'down') {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    
    if (direction === 'up') {
      this.ctx!.drawImage(from, 0, -height * progress, width, height);
      this.ctx!.drawImage(to, 0, height * (1 - progress), width, height);
    } else {
      this.ctx!.drawImage(from, 0, height * progress, width, height);
      this.ctx!.drawImage(to, 0, -height * (1 - progress), width, height);
    }
  }
  
  /**
   * Push transition
   */
  private renderPush(from: any, to: any, progress: number, direction: 'left' | 'right') {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    
    if (direction === 'left') {
      this.ctx!.drawImage(from, -width * progress, 0, width, height);
      this.ctx!.drawImage(to, width * (1 - progress), 0, width, height);
    } else {
      this.ctx!.drawImage(from, width * progress, 0, width, height);
      this.ctx!.drawImage(to, -width * (1 - progress), 0, width, height);
    }
  }
  
  /**
   * Rotate transition (2D)
   */
  private renderRotate(from: any, to: any, progress: number, direction: 'left' | 'right') {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    const angle = (direction === 'left' ? -1 : 1) * progress * Math.PI * 2;
    const scale = 0.5 + (0.5 * Math.abs(Math.cos(angle)));
    
    this.ctx!.save();
    this.ctx!.translate(centerX, centerY);
    this.ctx!.rotate(angle);
    this.ctx!.scale(scale, scale);
    this.ctx!.globalAlpha = 1 - progress;
    this.ctx!.drawImage(from, -width / 2, -height / 2, width, height);
    this.ctx!.restore();
    
    this.ctx!.globalAlpha = progress;
    this.ctx!.drawImage(to, 0, 0, width, height);
    this.ctx!.globalAlpha = 1;
  }
  
  /**
   * Flip transition
   */
  private renderFlip(from: any, to: any, progress: number, axis: 'horizontal' | 'vertical') {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    this.ctx!.save();
    this.ctx!.translate(centerX, centerY);
    
    if (axis === 'horizontal') {
      const scaleX = Math.cos(progress * Math.PI);
      this.ctx!.scale(scaleX, 1);
      
      if (progress < 0.5) {
        this.ctx!.drawImage(from, -width / 2, -height / 2, width, height);
      } else {
        this.ctx!.scale(-1, 1);
        this.ctx!.drawImage(to, -width / 2, -height / 2, width, height);
      }
    } else {
      const scaleY = Math.cos(progress * Math.PI);
      this.ctx!.scale(1, scaleY);
      
      if (progress < 0.5) {
        this.ctx!.drawImage(from, -width / 2, -height / 2, width, height);
      } else {
        this.ctx!.scale(1, -1);
        this.ctx!.drawImage(to, -width / 2, -height / 2, width, height);
      }
    }
    
    this.ctx!.restore();
  }
  
  /**
   * Radial blur
   */
  private renderRadialBlur(from: any, to: any, progress: number) {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Radial blur effect (simplified)
    if (progress < 0.5) {
      const blurLayers = 8;
      this.ctx!.globalAlpha = 1 / blurLayers;
      for (let i = 0; i < blurLayers; i++) {
        const scale = 1 + (progress * 2 * i / blurLayers);
        const offsetX = centerX * (1 - scale);
        const offsetY = centerY * (1 - scale);
        this.ctx!.drawImage(from, offsetX, offsetY, width * scale, height * scale);
      }
      this.ctx!.globalAlpha = 1;
    } else {
      const blurProgress = (progress - 0.5) * 2;
      const blurLayers = 8;
      this.ctx!.globalAlpha = 1 / blurLayers;
      for (let i = 0; i < blurLayers; i++) {
        const scale = 1 + ((1 - blurProgress) * i / blurLayers);
        const offsetX = centerX * (1 - scale);
        const offsetY = centerY * (1 - scale);
        this.ctx!.drawImage(to, offsetX, offsetY, width * scale, height * scale);
      }
      this.ctx!.globalAlpha = 1;
    }
  }
  
  /**
   * Directional blur
   */
  private renderDirectionalBlur(from: any, to: any, progress: number) {
    if (progress < 0.5) {
      const blurLayers = 6;
      this.ctx!.globalAlpha = 1 / blurLayers;
      for (let i = 0; i < blurLayers; i++) {
        const offset = (progress * 2) * (i * 10);
        this.ctx!.drawImage(from, offset, 0, this.canvas!.width, this.canvas!.height);
      }
      this.ctx!.globalAlpha = 1;
    } else {
      const blurProgress = (progress - 0.5) * 2;
      const blurLayers = 6;
      this.ctx!.globalAlpha = 1 / blurLayers;
      for (let i = 0; i < blurLayers; i++) {
        const offset = (1 - blurProgress) * (i * 10);
        this.ctx!.drawImage(to, -offset, 0, this.canvas!.width, this.canvas!.height);
      }
      this.ctx!.globalAlpha = 1;
    }
  }
  
  /**
   * RGB channel split
   */
  private renderRGBSplit(from: any, to: any, progress: number) {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    const offset = progress * 20;
    
    if (progress < 0.5) {
      // Split from frame
      const imageData = this.ctx!.getImageData(0, 0, width, height);
      this.ctx!.drawImage(from, 0, 0, width, height);
      
      // Red channel offset
      this.ctx!.globalCompositeOperation = 'screen';
      this.ctx!.drawImage(from, -offset, 0, width, height);
      // Blue channel offset
      this.ctx!.drawImage(from, offset, 0, width, height);
      this.ctx!.globalCompositeOperation = 'source-over';
      
      // Fade to black
      this.ctx!.fillStyle = `rgba(0,0,0,${progress * 2})`;
      this.ctx!.fillRect(0, 0, width, height);
    } else {
      const splitProgress = (progress - 0.5) * 2;
      const currentOffset = (1 - splitProgress) * 20;
      
      this.ctx!.drawImage(to, 0, 0, width, height);
      
      this.ctx!.globalCompositeOperation = 'screen';
      this.ctx!.drawImage(to, -currentOffset, 0, width, height);
      this.ctx!.drawImage(to, currentOffset, 0, width, height);
      this.ctx!.globalCompositeOperation = 'source-over';
    }
  }
  
  /**
   * Venetian blinds
   */
  private renderVenetianBlinds(from: any, to: any, progress: number) {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    const blinds = 10;
    const blindHeight = height / blinds;
    
    this.ctx!.drawImage(from, 0, 0, width, height);
    
    for (let i = 0; i < blinds; i++) {
      const y = i * blindHeight;
      const blindProgress = Math.max(0, Math.min(1, (progress - (i * 0.1)) * 1.5));
      const currentHeight = blindHeight * blindProgress;
      
      this.ctx!.drawImage(
        to,
        0, y, width, blindHeight,
        0, y, width, currentHeight
      );
    }
  }
  
  /**
   * Checkerboard reveal
   */
  private renderCheckerboard(from: any, to: any, progress: number) {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    const squares = 8;
    const squareWidth = width / squares;
    const squareHeight = height / squares;
    
    this.ctx!.drawImage(from, 0, 0, width, height);
    
    this.ctx!.save();
    this.ctx!.beginPath();
    
    for (let x = 0; x < squares; x++) {
      for (let y = 0; y < squares; y++) {
        if ((x + y) % 2 === 0) {
          const squareProgress = Math.max(0, Math.min(1, (progress - ((x + y) * 0.05)) * 1.5));
          if (squareProgress > 0) {
            this.ctx!.rect(
              x * squareWidth,
              y * squareHeight,
              squareWidth * squareProgress,
              squareHeight * squareProgress
            );
          }
        }
      }
    }
    
    this.ctx!.clip();
    this.ctx!.drawImage(to, 0, 0, width, height);
    this.ctx!.restore();
  }
  
  /**
   * Swap positions
   */
  private renderSwap(from: any, to: any, progress: number) {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    
    // From frame moves left and scales down
    this.ctx!.save();
    const scale = 1 - (progress * 0.3);
    const offsetX = -width * progress;
    this.ctx!.translate(width / 2 + offsetX, height / 2);
    this.ctx!.scale(scale, scale);
    this.ctx!.globalAlpha = 1 - progress;
    this.ctx!.drawImage(from, -width / 2, -height / 2, width, height);
    this.ctx!.restore();
    
    // To frame moves in from right
    this.ctx!.save();
    const toScale = 0.7 + (progress * 0.3);
    const toOffsetX = width * (1 - progress);
    this.ctx!.translate(width / 2 + toOffsetX, height / 2);
    this.ctx!.scale(toScale, toScale);
    this.ctx!.globalAlpha = progress;
    this.ctx!.drawImage(to, -width / 2, -height / 2, width, height);
    this.ctx!.restore();
  }
  
  /**
   * 3D Cube rotation
   */
  private renderCube(from: any, to: any, progress: number, direction: 'left' | 'right') {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Simplified 3D cube effect
    const angle = (direction === 'left' ? 1 : -1) * progress * (Math.PI / 2);
    
    this.ctx!.save();
    this.ctx!.translate(centerX, centerY);
    
    // From face
    if (progress < 0.5) {
      const scale = Math.cos(angle);
      this.ctx!.scale(scale, 1);
      this.ctx!.drawImage(from, -width / 2, -height / 2, width, height);
    }
    
    // To face (other side of cube)
    if (progress > 0.5) {
      const toAngle = angle - (Math.PI / 2);
      const scale = -Math.cos(toAngle);
      this.ctx!.scale(scale, 1);
      this.ctx!.drawImage(to, -width / 2, -height / 2, width, height);
    }
    
    this.ctx!.restore();
  }
  
  /**
   * Page curl effect
   */
  private renderPageCurl(from: any, to: any, progress: number) {
    const width = this.canvas!.width;
    const height = this.canvas!.height;
    
    // Draw to frame
    this.ctx!.drawImage(to, 0, 0, width, height);
    
    // Draw from frame with curl
    this.ctx!.save();
    this.ctx!.beginPath();
    
    const curlWidth = width * (1 - progress);
    const curlAmount = progress * 50;
    
    // Create curl path
    this.ctx!.moveTo(0, 0);
    this.ctx!.lineTo(curlWidth, 0);
    this.ctx!.quadraticCurveTo(
      curlWidth + curlAmount,
      height / 2,
      curlWidth,
      height
    );
    this.ctx!.lineTo(0, height);
    this.ctx!.closePath();
    this.ctx!.clip();
    
    this.ctx!.drawImage(from, 0, 0, width, height);
    
    // Draw shadow for curl
    const gradient = this.ctx!.createLinearGradient(curlWidth - 20, 0, curlWidth, 0);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
    this.ctx!.fillStyle = gradient;
    this.ctx!.fillRect(curlWidth - 20, 0, 20, height);
    
    this.ctx!.restore();
  }
  
  /**
   * Get transition duration recommendation
   */
  getRecommendedDuration(type: TransitionType): number {
    return TransitionEffectsEngine.getRecommendedDuration(type);
  }

  /**
   * Get transition categories (instance API for runtime consumers)
   */
  getTransitionCategories(): Array<{
    name: string;
    transitions: Array<{ type: TransitionType; name: string; duration: number }>;
  }> {
    return TransitionEffectsEngine.getTransitionCategories();
  }

  /**
   * Get transition duration recommendation
   */
  static getRecommendedDuration(type: TransitionType): number {
    const durations: Record<TransitionType, number> = {
      // Basic
      'cut': 0,
      'crossfade': 0.5,
      'fade_black': 1.0,
      'fade_white': 1.0,
      // Wipe
      'wipe_left': 0.7,
      'wipe_right': 0.7,
      'wipe_up': 0.7,
      'wipe_down': 0.7,
      'wipe_diagonal': 0.8,
      'clock_wipe': 1.0,
      'iris_in': 0.8,
      'iris_out': 0.8,
      // Slide & Push
      'slide_left': 0.5,
      'slide_right': 0.5,
      'slide_up': 0.5,
      'slide_down': 0.5,
      'push_left': 0.6,
      'push_right': 0.6,
      // Zoom & Rotate
      'zoom_in': 0.8,
      'zoom_out': 0.8,
      'rotate_left': 0.7,
      'rotate_right': 0.7,
      'flip_horizontal': 0.6,
      'flip_vertical': 0.6,
      // Effects
      'blur': 0.6,
      'radial_blur': 0.8,
      'directional_blur': 0.7,
      'pixelate': 0.8,
      'glitch': 0.4,
      'rgb_split': 0.5,
      'venetian_blinds': 0.9,
      'checkerboard': 0.8,
      'swap': 0.7,
      'cube_left': 0.9,
      'cube_right': 0.9,
      'page_curl': 1.0
    };
    
    return durations[type];
  }
  
  /**
   * Get transition categories (like CapCut + Premiere Pro)
   */
  static getTransitionCategories(): Array<{
    name: string;
    transitions: Array<{ type: TransitionType; name: string; duration: number }>;
  }> {
    return [
      {
        name: 'Basic',
        transitions: [
          { type: 'cut', name: 'Cut', duration: 0 },
          { type: 'crossfade', name: 'Crossfade', duration: 0.5 },
          { type: 'fade_black', name: 'Fade Black', duration: 1.0 },
          { type: 'fade_white', name: 'Fade White', duration: 1.0 }
        ]
      },
      {
        name: 'Wipe',
        transitions: [
          { type: 'wipe_left', name: 'Wipe Left', duration: 0.7 },
          { type: 'wipe_right', name: 'Wipe Right', duration: 0.7 },
          { type: 'wipe_up', name: 'Wipe Up', duration: 0.7 },
          { type: 'wipe_down', name: 'Wipe Down', duration: 0.7 },
          { type: 'wipe_diagonal', name: 'Diagonal Wipe', duration: 0.8 },
          { type: 'clock_wipe', name: 'Clock Wipe', duration: 1.0 },
          { type: 'iris_in', name: 'Iris In', duration: 0.8 },
          { type: 'iris_out', name: 'Iris Out', duration: 0.8 }
        ]
      },
      {
        name: 'Slide & Push',
        transitions: [
          { type: 'slide_left', name: 'Slide Left', duration: 0.5 },
          { type: 'slide_right', name: 'Slide Right', duration: 0.5 },
          { type: 'slide_up', name: 'Slide Up', duration: 0.5 },
          { type: 'slide_down', name: 'Slide Down', duration: 0.5 },
          { type: 'push_left', name: 'Push Left', duration: 0.6 },
          { type: 'push_right', name: 'Push Right', duration: 0.6 }
        ]
      },
      {
        name: 'Zoom & Rotate',
        transitions: [
          { type: 'zoom_in', name: 'Zoom In', duration: 0.8 },
          { type: 'zoom_out', name: 'Zoom Out', duration: 0.8 },
          { type: 'rotate_left', name: 'Rotate Left', duration: 0.7 },
          { type: 'rotate_right', name: 'Rotate Right', duration: 0.7 },
          { type: 'flip_horizontal', name: 'Flip Horizontal', duration: 0.6 },
          { type: 'flip_vertical', name: 'Flip Vertical', duration: 0.6 }
        ]
      },
      {
        name: '3D Effects',
        transitions: [
          { type: 'cube_left', name: 'Cube Left', duration: 0.9 },
          { type: 'cube_right', name: 'Cube Right', duration: 0.9 },
          { type: 'page_curl', name: 'Page Curl', duration: 1.0 },
          { type: 'swap', name: 'Swap', duration: 0.7 }
        ]
      },
      {
        name: 'Blur Effects',
        transitions: [
          { type: 'blur', name: 'Blur', duration: 0.6 },
          { type: 'radial_blur', name: 'Radial Blur', duration: 0.8 },
          { type: 'directional_blur', name: 'Directional Blur', duration: 0.7 }
        ]
      },
      {
        name: 'Creative',
        transitions: [
          { type: 'pixelate', name: 'Pixelate', duration: 0.8 },
          { type: 'glitch', name: 'Glitch', duration: 0.4 },
          { type: 'rgb_split', name: 'RGB Split', duration: 0.5 },
          { type: 'venetian_blinds', name: 'Venetian Blinds', duration: 0.9 },
          { type: 'checkerboard', name: 'Checkerboard', duration: 0.8 }
        ]
      }
    ];
  }
}

export const transitionEngine = new TransitionEffectsEngine();
