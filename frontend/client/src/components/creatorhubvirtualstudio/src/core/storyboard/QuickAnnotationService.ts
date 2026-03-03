/**
 * QuickAnnotationService - One-click annotation tools for storyboard frames
 * 
 * Adds quick annotations without opening the full editor:
 * - Motion arrows (left, right, up, down)
 * - Actor markers with labels
 * - Camera path indicators
 * - Light position markers
 * - Focus area rectangles
 */

import { StoryboardFrame } from '../../state/storyboardStore';
import { QuickAnnotationType } from '../../ui/components/FrameContextMenu';

// =============================================================================
// Types
// =============================================================================

export interface AnnotationObject {
  id: string;
  type: 'arrow' | 'marker' | 'path' | 'area' | 'text';
  subtype?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  color: string;
  label?: string;
  points?: { x: number; y: number }[];
}

export interface QuickAnnotationConfig {
  type: QuickAnnotationType;
  color: string;
  label?: string;
  size: number;
}

// =============================================================================
// Default Annotation Configurations
// =============================================================================

const ANNOTATION_CONFIGS: Record<QuickAnnotationType, Partial<QuickAnnotationConfig>> = {
  arrow_left: {
    color: '#FF9800',
    size: 80,
  },
  arrow_right: {
    color: '#FF9800',
    size: 80,
  },
  arrow_up: {
    color: '#FF9800',
    size: 80,
  },
  arrow_down: {
    color: '#FF9800',
    size: 80,
  },
  actor_marker: {
    color: '#4CAF50',
    label: 'A',
    size: 40,
  },
  camera_path: {
    color: '#2196F3',
    size: 60,
  },
  light_marker: {
    color: '#FFC107',
    label: 'L',
    size: 36,
  },
  focus_area: {
    color: '#E91E63',
    size: 120,
  },
};

// =============================================================================
// QuickAnnotationService Class
// =============================================================================

export class QuickAnnotationService {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private actorCounter = 1;
  private lightCounter = 1;

  /**
   * Add a quick annotation to a frame image
   */
  async addAnnotation(
    frame: StoryboardFrame,
    type: QuickAnnotationType,
    position?: { x: number; y: number }
  ): Promise<string> {
    if (!frame.imageUrl) {
      throw new Error('Frame has no image , ');
    }

    // Load the image
    const img = await this.loadImage(frame.imageUrl);
    
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = img.width;
    this.canvas.height = img.height;
    this.ctx = this.canvas.getContext('2d');

    if (!this.ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw original image
    this.ctx.drawImage(img, 0, 0);

    // Calculate position (center if not specified)
    const pos = position || {
      x: img.width / 2,
      y: img.height / 2,
    };

    // Draw annotation based on type
    const config = ANNOTATION_CONFIGS[type];
    
    switch (type) {
      case 'arrow_left':
        this.drawArrow(pos.x, pos.y, 'left', config.color!, config.size!);
        break;
      case 'arrow_right':
        this.drawArrow(pos.x, pos.y, 'right', config.color!, config.size!);
        break;
      case 'arrow_up':
        this.drawArrow(pos.x, pos.y, 'up', config.color!, config.size!);
        break;
      case 'arrow_down':
        this.drawArrow(pos.x, pos.y, 'down', config.color!, config.size!);
        break;
      case 'actor_marker':
        this.drawActorMarker(pos.x, pos.y, config.color!, config.size!);
        break;
      case 'camera_path':
        this.drawCameraPath(pos.x, pos.y, config.color!, config.size!);
        break;
      case 'light_marker':
        this.drawLightMarker(pos.x, pos.y, config.color!, config.size!);
        break;
      case 'focus_area':
        this.drawFocusArea(pos.x, pos.y, config.color!, config.size!);
        break;
    }

    // Return as data URL
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Add multiple annotations at once
   */
  async addMultipleAnnotations(
    frame: StoryboardFrame,
    annotations: Array<{ type: QuickAnnotationType; position: { x: number; y: number } }>
  ): Promise<string> {
    if (!frame.imageUrl) {
      throw new Error('Frame has no image');
    }

    const img = await this.loadImage(frame.imageUrl);
    
    this.canvas = document.createElement('canvas');
    this.canvas.width = img.width;
    this.canvas.height = img.height;
    this.ctx = this.canvas.getContext('2d');

    if (!this.ctx) {
      throw new Error('Failed to get canvas context');
    }

    this.ctx.drawImage(img, 0, 0);

    for (const annotation of annotations) {
      const config = ANNOTATION_CONFIGS[annotation.type];
      const pos = annotation.position;

      switch (annotation.type) {
        case 'arrow_left':
        case 'arrow_right':
        case 'arrow_up':
        case 'arrow_down':
          const dir = annotation.type.replace('arrow_', ', ') as 'left' | 'right' | 'up' | 'down';
          this.drawArrow(pos.x, pos.y, dir, config.color!, config.size!);
          break;
        case 'actor_marker':
          this.drawActorMarker(pos.x, pos.y, config.color!, config.size!);
          break;
        case 'camera_path':
          this.drawCameraPath(pos.x, pos.y, config.color!, config.size!);
          break;
        case 'light_marker':
          this.drawLightMarker(pos.x, pos.y, config.color!, config.size!);
          break;
        case 'focus_area':
          this.drawFocusArea(pos.x, pos.y, config.color!, config.size!);
          break;
      }
    }

    return this.canvas.toDataURL('image/png');
  }

  // =========================================================================
  // Drawing Methods
  // =========================================================================

  private drawArrow(
    x: number,
    y: number,
    direction: 'left' | 'right' | 'up' | 'down',
    color: string,
    size: number
  ): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.translate(x, y);

    // Rotate based on direction
    const rotations: Record<string, number> = {
      right: 0,
      down: Math.PI / 2,
      left: Math.PI,
      up: -Math.PI / 2,
    };
    this.ctx.rotate(rotations[direction]);

    // Draw arrow
    this.ctx.beginPath();
    this.ctx.moveTo(-size / 2, 0);
    this.ctx.lineTo(size / 2 - 15, 0);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();

    // Arrow head
    this.ctx.beginPath();
    this.ctx.moveTo(size / 2, 0);
    this.ctx.lineTo(size / 2 - 20, -12);
    this.ctx.lineTo(size / 2 - 20, 12);
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();

    this.ctx.restore();
  }

  private drawActorMarker(x: number, y: number, color: string, size: number): void {
    if (!this.ctx) return;

    // Circle
    this.ctx.beginPath();
    this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();

    // Border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Label
    const label = String.fromCharCode(64 + this.actorCounter); // A, B, C...
    this.ctx.font = `bold ${size * 0.6}px Arial`;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(label, x, y);

    this.actorCounter++;
  }

  private drawCameraPath(x: number, y: number, color: string, size: number): void {
    if (!this.ctx) return;

    // Camera icon
    this.ctx.save();
    this.ctx.translate(x, y);

    // Camera body
    this.ctx.beginPath();
    this.ctx.roundRect(-size / 2, -size / 3, size * 0.8, size * 0.6, 4);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Lens
    this.ctx.beginPath();
    this.ctx.arc(-size / 6, 0, size / 5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.stroke();

    // Viewfinder
    this.ctx.beginPath();
    this.ctx.moveTo(size / 4, -size / 3);
    this.ctx.lineTo(size / 2, -size / 2);
    this.ctx.lineTo(size / 2 + 10, -size / 2);
    this.ctx.lineTo(size / 2 + 10, -size / 4);
    this.ctx.lineTo(size / 4, -size / 4);
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();

    this.ctx.restore();

    // Path indicator (dashed line going right)
    this.ctx.beginPath();
    this.ctx.setLineDash([8, 4]);
    this.ctx.moveTo(x + size / 2 + 10, y);
    this.ctx.lineTo(x + size * 1.5, y);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Arrow at end
    this.ctx.beginPath();
    this.ctx.moveTo(x + size * 1.5 + 10, y);
    this.ctx.lineTo(x + size * 1.5 - 5, y - 8);
    this.ctx.lineTo(x + size * 1.5 - 5, y + 8);
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  private drawLightMarker(x: number, y: number, color: string, size: number): void {
    if (!this.ctx) return;

    // Light bulb shape
    this.ctx.save();
    this.ctx.translate(x, y);

    // Glow effect
    const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    gradient.addColorStop(0, color + '80');
    gradient.addColorStop(1, 'transparent');
    this.ctx.beginPath();
    this.ctx.arc(0, 0, size, 0, Math.PI * 2);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    // Bulb
    this.ctx.beginPath();
    this.ctx.arc(0, -size / 6, size / 2.5, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Base
    this.ctx.beginPath();
    this.ctx.moveTo(-size / 6, size / 6);
    this.ctx.lineTo(-size / 8, size / 3);
    this.ctx.lineTo(size / 8, size / 3);
    this.ctx.lineTo(size / 6, size / 6);
    this.ctx.closePath();
    this.ctx.fillStyle = '#666666';
    this.ctx.fill();

    // Light number
    this.ctx.font = `bold ${size / 3}px Arial`;
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(String(this.lightCounter), 0, -size / 6);

    this.ctx.restore();
    this.lightCounter++;
  }

  private drawFocusArea(x: number, y: number, color: string, size: number): void {
    if (!this.ctx) return;

    // Focus brackets
    const halfSize = size / 2;
    const bracketLength = size / 4;
    const lineWidth = 3;

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.lineCap = 'round';

    // Top-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(x - halfSize, y - halfSize + bracketLength);
    this.ctx.lineTo(x - halfSize, y - halfSize);
    this.ctx.lineTo(x - halfSize + bracketLength, y - halfSize);
    this.ctx.stroke();

    // Top-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(x + halfSize - bracketLength, y - halfSize);
    this.ctx.lineTo(x + halfSize, y - halfSize);
    this.ctx.lineTo(x + halfSize, y - halfSize + bracketLength);
    this.ctx.stroke();

    // Bottom-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(x + halfSize, y + halfSize - bracketLength);
    this.ctx.lineTo(x + halfSize, y + halfSize);
    this.ctx.lineTo(x + halfSize - bracketLength, y + halfSize);
    this.ctx.stroke();

    // Bottom-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(x - halfSize + bracketLength, y + halfSize);
    this.ctx.lineTo(x - halfSize, y + halfSize);
    this.ctx.lineTo(x - halfSize, y + halfSize - bracketLength);
    this.ctx.stroke();

    // Center crosshair
    this.ctx.beginPath();
    this.ctx.setLineDash([4, 4]);
    this.ctx.moveTo(x - 15, y);
    this.ctx.lineTo(x + 15, y);
    this.ctx.moveTo(x, y - 15);
    this.ctx.lineTo(x, y + 15);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin ='anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /**
   * Reset counters for new storyboard
   */
  resetCounters(): void {
    this.actorCounter = 1;
    this.lightCounter = 1;
  }

  /**
   * Clear annotations from frame (return original)
   */
  async clearAnnotations(originalImageUrl: string): Promise<string> {
    return originalImageUrl;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const quickAnnotationService = new QuickAnnotationService();

export default quickAnnotationService;
