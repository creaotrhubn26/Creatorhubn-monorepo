/**
 * FrameCanvasEngine - Drawing and annotation engine for storyboard frames
 * 
 * Uses native Canvas API for maximum compatibility and performance.
 * Supports drawing, shapes, text, arrows, and actor blocking markers.
 */

// =============================================================================
// Types
// =============================================================================

import { logger } from '../services/logger';

const log = logger.module('FrameCanvasEngine');

export type ToolType = 
  | 'select'
  | 'pen'
  | 'line'
  | 'arrow'
  | 'rectangle'
  | 'circle'
  | 'text'
  | 'marker'
  | 'eraser';

export interface Point {
  x: number;
  y: number;
}

export interface DrawingStyle {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
  opacity: number;
}

export interface CanvasObject {
  id: string;
  type: ToolType;
  points?: Point[];
  start?: Point;
  end?: Point;
  text?: string;
  style: DrawingStyle;
  visible: boolean;
  locked: boolean;
  layer: number;
}

export interface CanvasState {
  objects: CanvasObject[];
  width: number;
  height: number;
  backgroundColor: string;
}

export interface HistoryEntry {
  objects: CanvasObject[];
  timestamp: number;
}

// =============================================================================
// Default Styles
// =============================================================================

export const DEFAULT_STYLE: DrawingStyle = {
  strokeColor: '#ff4444',
  fillColor: 'transparent',
  strokeWidth: 3,
  fontSize: 24,
  fontFamily: 'system-ui, sans-serif',
  opacity: 1,
};

export const MARKER_COLORS = {
  actor: '#4CAF50',
  camera: '#2196F3',
  light: '#FFC107',
  prop: '#9C27B0',
  movement: '#FF5722',
};

// =============================================================================
// Frame Canvas Engine
// =============================================================================

export class FrameCanvasEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private backgroundImage: HTMLImageElement | null = null;
  
  // State
  private objects: CanvasObject[] = [];
  private selectedObjectId: string | null = null;
  private currentTool: ToolType = 'select';
  private currentStyle: DrawingStyle = { ...DEFAULT_STYLE };
  
  // Drawing state
  private isDrawing: boolean = false;
  private currentPath: Point[] = [];
  private startPoint: Point | null = null;
  
  // History
  private history: HistoryEntry[] = [];
  private historyIndex: number = -1;
  private maxHistory: number = 50;
  
  // Callbacks
  private onChange?: (state: CanvasState) => void;
  private onSelect?: (objectId: string | null) => void;

  // ==========================================================================
  // Initialization
  // ==========================================================================

  initialize(
    canvas: HTMLCanvasElement,
    backgroundImageUrl?: string,
    onChange?: (state: CanvasState) => void,
    onSelect?: (objectId: string | null) => void
  ): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onChange = onChange;
    this.onSelect = onSelect;

    if (!this.ctx) {
      throw new Error('Could not get 2D context');
    }

    // Load background image if provided
    if (backgroundImageUrl) {
      this.loadBackgroundImage(backgroundImageUrl);
    }

    // Set up event listeners
    this.setupEventListeners();

    // Initial render
    this.render();

    // Save initial state to history
    this.saveToHistory();

    log.debug('FrameCanvasEngine initialized');
  }

  private loadBackgroundImage(url: string): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.backgroundImage = img;
      this.render();
    };
    img.src = url;
  }

  private setupEventListeners(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
    
    // Touch support
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
  }

  destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
      this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
      this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
      this.canvas.removeEventListener('mouseleave', this.handleMouseUp.bind(this));
    }
    this.canvas = null;
    this.ctx = null;
  }

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  private getMousePosition(e: MouseEvent): Point {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  private getTouchPosition(e: TouchEvent): Point {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };
  }

  private handleMouseDown(e: MouseEvent): void {
    const pos = this.getMousePosition(e);
    this.startDrawing(pos);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isDrawing) return;
    const pos = this.getMousePosition(e);
    this.continueDrawing(pos);
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.isDrawing) return;
    const pos = this.getMousePosition(e);
    this.finishDrawing(pos);
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const pos = this.getTouchPosition(e);
    this.startDrawing(pos);
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDrawing) return;
    const pos = this.getTouchPosition(e);
    this.continueDrawing(pos);
  }

  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDrawing) return;
    const pos = this.getTouchPosition(e);
    this.finishDrawing(pos);
  }

  // ==========================================================================
  // Drawing Logic
  // ==========================================================================

  private startDrawing(pos: Point): void {
    this.isDrawing = true;
    this.startPoint = pos;
    this.currentPath = [pos];

    if (this.currentTool === 'select') {
      this.handleSelection(pos);
    }
  }

  private continueDrawing(pos: Point): void {
    if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
      this.currentPath.push(pos);
    }
    this.render();
    this.drawPreview(pos);
  }

  private finishDrawing(pos: Point): void {
    this.isDrawing = false;

    if (this.currentTool === 'select') {
      return;
    }

    // Create the object
    const object = this.createObject(pos);
    if (object) {
      this.objects.push(object);
      this.saveToHistory();
      this.notifyChange();
    }

    this.currentPath = [];
    this.startPoint = null;
    this.render();
  }

  private createObject(endPos: Point): CanvasObject | null {
    const id = crypto.randomUUID();
    const baseObject = {
      id,
      style: { ...this.currentStyle },
      visible: true,
      locked: false,
      layer: this.objects.length,
    };

    switch (this.currentTool) {
      case 'pen':
        return {
          ...baseObject,
          type: 'pen',
          points: [...this.currentPath],
        };

      case 'eraser':
        return {
          ...baseObject,
          type: 'eraser',
          points: [...this.currentPath],
          style: { ...this.currentStyle, strokeColor: '#000000', strokeWidth: 20 },
        };

      case 'line':
        if (!this.startPoint) return null;
        return {
          ...baseObject,
          type: 'line',
          start: this.startPoint,
          end: endPos,
        };

      case 'arrow':
        if (!this.startPoint) return null;
        return {
          ...baseObject,
          type: 'arrow',
          start: this.startPoint,
          end: endPos,
        };

      case 'rectangle':
        if (!this.startPoint) return null;
        return {
          ...baseObject,
          type: 'rectangle',
          start: this.startPoint,
          end: endPos,
        };

      case 'circle':
        if (!this.startPoint) return null;
        return {
          ...baseObject,
          type: 'circle',
          start: this.startPoint,
          end: endPos,
        };

      case 'marker':
        return {
          ...baseObject,
          type: 'marker',
          start: endPos,
          text: 'A',
          style: { ...this.currentStyle, fillColor: MARKER_COLORS.actor },
        };

      default:
        return null;
    }
  }

  private handleSelection(pos: Point): void {
    // Find object at position (reverse order for top objects first)
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      if (this.isPointInObject(pos, obj)) {
        this.selectedObjectId = obj.id;
        this.onSelect?.(obj.id);
        this.render();
        return;
      }
    }
    this.selectedObjectId = null;
    this.onSelect?.(null);
    this.render();
  }

  private isPointInObject(pos: Point, obj: CanvasObject): boolean {
    const threshold = 10;

    switch (obj.type) {
      case 'rectangle':
        if (!obj.start || !obj.end) return false;
        const minX = Math.min(obj.start.x, obj.end.x);
        const maxX = Math.max(obj.start.x, obj.end.x);
        const minY = Math.min(obj.start.y, obj.end.y);
        const maxY = Math.max(obj.start.y, obj.end.y);
        return pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY;

      case 'circle':
        if (!obj.start || !obj.end) return false;
        const cx = (obj.start.x + obj.end.x) / 2;
        const cy = (obj.start.y + obj.end.y) / 2;
        const rx = Math.abs(obj.end.x - obj.start.x) / 2;
        const ry = Math.abs(obj.end.y - obj.start.y) / 2;
        const dx = (pos.x - cx) / rx;
        const dy = (pos.y - cy) / ry;
        return dx * dx + dy * dy <= 1;

      case 'marker':
        if (!obj.start) return false;
        const dist = Math.sqrt(Math.pow(pos.x - obj.start.x, 2) + Math.pow(pos.y - obj.start.y, 2));
        return dist <= 20;

      case 'pen':
      case 'line':
      case 'arrow':
        // Simplified hit test
        if (obj.points && obj.points.length > 0) {
          for (const p of obj.points) {
            if (Math.abs(pos.x - p.x) < threshold && Math.abs(pos.y - p.y) < threshold) {
              return true;
            }
          }
        }
        if (obj.start && obj.end) {
          // Line hit test
          const d = this.pointToLineDistance(pos, obj.start, obj.end);
          return d < threshold;
        }
        return false;

      default:
        return false;
    }
  }

  private pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    return Math.sqrt(Math.pow(point.x - xx, 2) + Math.pow(point.y - yy, 2));
  }

  // ==========================================================================
  // Rendering
  // ==========================================================================

  render(): void {
    if (!this.ctx || !this.canvas) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw background image
    if (this.backgroundImage) {
      this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
    }

    // Draw objects
    for (const obj of this.objects) {
      if (!obj.visible) continue;
      this.drawObject(obj);
    }

    // Draw selection
    if (this.selectedObjectId) {
      const selected = this.objects.find((o) => o.id === this.selectedObjectId);
      if (selected) {
        this.drawSelection(selected);
      }
    }
  }

  private drawPreview(currentPos: Point): void {
    if (!this.ctx || !this.startPoint) return;

    this.ctx.save();
    this.ctx.globalAlpha = 0.5;
    this.ctx.strokeStyle = this.currentStyle.strokeColor;
    this.ctx.lineWidth = this.currentStyle.strokeWidth;
    this.ctx.setLineDash([5, 5]);

    switch (this.currentTool) {
      case 'pen':
        this.drawPath(this.currentPath);
        break;

      case 'line':
        this.ctx.beginPath();
        this.ctx.moveTo(this.startPoint.x, this.startPoint.y);
        this.ctx.lineTo(currentPos.x, currentPos.y);
        this.ctx.stroke();
        break;

      case 'arrow':
        this.drawArrow(this.startPoint, currentPos);
        break;

      case 'rectangle':
        this.ctx.strokeRect(
          this.startPoint.x,
          this.startPoint.y,
          currentPos.x - this.startPoint.x,
          currentPos.y - this.startPoint.y
        );
        break;

      case 'circle':
        const cx = (this.startPoint.x + currentPos.x) / 2;
        const cy = (this.startPoint.y + currentPos.y) / 2;
        const rx = Math.abs(currentPos.x - this.startPoint.x) / 2;
        const ry = Math.abs(currentPos.y - this.startPoint.y) / 2;
        this.ctx.beginPath();
        this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        this.ctx.stroke();
        break;
    }

    this.ctx.restore();
  }

  private drawObject(obj: CanvasObject): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.globalAlpha = obj.style.opacity;
    this.ctx.strokeStyle = obj.style.strokeColor;
    this.ctx.fillStyle = obj.style.fillColor;
    this.ctx.lineWidth = obj.style.strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    switch (obj.type) {
      case 'pen':
        if (obj.points) this.drawPath(obj.points);
        break;

      case 'eraser':
        if (obj.points) {
          this.ctx.globalCompositeOperation = 'destination-out';
          this.drawPath(obj.points);
          this.ctx.globalCompositeOperation = 'source-over';
        }
        break;

      case 'line':
        if (obj.start && obj.end) {
          this.ctx.beginPath();
          this.ctx.moveTo(obj.start.x, obj.start.y);
          this.ctx.lineTo(obj.end.x, obj.end.y);
          this.ctx.stroke();
        }
        break;

      case 'arrow':
        if (obj.start && obj.end) {
          this.drawArrow(obj.start, obj.end);
        }
        break;

      case 'rectangle':
        if (obj.start && obj.end) {
          if (obj.style.fillColor !== 'transparent') {
            this.ctx.fillRect(
              obj.start.x,
              obj.start.y,
              obj.end.x - obj.start.x,
              obj.end.y - obj.start.y
            );
          }
          this.ctx.strokeRect(
            obj.start.x,
            obj.start.y,
            obj.end.x - obj.start.x,
            obj.end.y - obj.start.y
          );
        }
        break;

      case 'circle':
        if (obj.start && obj.end) {
          const cx = (obj.start.x + obj.end.x) / 2;
          const cy = (obj.start.y + obj.end.y) / 2;
          const rx = Math.abs(obj.end.x - obj.start.x) / 2;
          const ry = Math.abs(obj.end.y - obj.start.y) / 2;
          this.ctx.beginPath();
          this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          if (obj.style.fillColor !== 'transparent') {
            this.ctx.fill();
          }
          this.ctx.stroke();
        }
        break;

      case 'marker':
        if (obj.start) {
          this.drawMarker(obj.start, obj.text || 'A', obj.style.fillColor);
        }
        break;

      case 'text':
        if (obj.start && obj.text) {
          this.ctx.font = `${obj.style.fontSize}px ${obj.style.fontFamily}`;
          this.ctx.fillStyle = obj.style.strokeColor;
          this.ctx.fillText(obj.text, obj.start.x, obj.start.y);
        }
        break;
    }

    this.ctx.restore();
  }

  private drawPath(points: Point[]): void {
    if (!this.ctx || points.length < 2) return;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.stroke();
  }

  private drawArrow(start: Point, end: Point): void {
    if (!this.ctx) return;
    const headLength = 15;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    // Draw line
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();

    // Draw arrowhead
    this.ctx.beginPath();
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.stroke();
  }

  private drawMarker(pos: Point, label: string, color: string): void {
    if (!this.ctx) return;
    const radius = 16;

    // Circle
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Label
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 14px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(label, pos.x, pos.y);
  }

  private drawSelection(obj: CanvasObject): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.strokeStyle = '#2196F3';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    // Get bounding box
    const bounds = this.getObjectBounds(obj);
    if (bounds) {
      const padding = 5;
      this.ctx.strokeRect(
        bounds.x - padding,
        bounds.y - padding,
        bounds.width + padding * 2,
        bounds.height + padding * 2
      );

      // Draw handles
      this.ctx.fillStyle = '#2196F3';
      const handleSize = 8;
      const corners = [
        { x: bounds.x - padding, y: bounds.y - padding },
        { x: bounds.x + bounds.width + padding, y: bounds.y - padding },
        { x: bounds.x - padding, y: bounds.y + bounds.height + padding },
        { x: bounds.x + bounds.width + padding, y: bounds.y + bounds.height + padding },
      ];
      for (const corner of corners) {
        this.ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
      }
    }

    this.ctx.restore();
  }

  private getObjectBounds(obj: CanvasObject): { x: number; y: number; width: number; height: number } | null {
    if (obj.start && obj.end) {
      return {
        x: Math.min(obj.start.x, obj.end.x),
        y: Math.min(obj.start.y, obj.end.y),
        width: Math.abs(obj.end.x - obj.start.x),
        height: Math.abs(obj.end.y - obj.start.y),
      };
    }
    if (obj.points && obj.points.length > 0) {
      const xs = obj.points.map((p) => p.x);
      const ys = obj.points.map((p) => p.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    }
    if (obj.start) {
      return { x: obj.start.x - 20, y: obj.start.y - 20, width: 40, height: 40 };
    }
    return null;
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  setTool(tool: ToolType): void {
    this.currentTool = tool;
    if (tool !== 'select') {
      this.selectedObjectId = null;
      this.onSelect?.(null);
    }
  }

  getTool(): ToolType {
    return this.currentTool;
  }

  setStyle(style: Partial<DrawingStyle>): void {
    this.currentStyle = { ...this.currentStyle, ...style };
  }

  getStyle(): DrawingStyle {
    return { ...this.currentStyle };
  }

  addText(pos: Point, text: string): void {
    const obj: CanvasObject = {
      id: crypto.randomUUID(),
      type: 'text',
      start: pos,
      text,
      style: { ...this.currentStyle },
      visible: true,
      locked: false,
      layer: this.objects.length,
    };
    this.objects.push(obj);
    this.saveToHistory();
    this.notifyChange();
    this.render();
  }

  addMarker(pos: Point, label: string, type: keyof typeof MARKER_COLORS = 'actor'): void {
    const obj: CanvasObject = {
      id: crypto.randomUUID(),
      type: 'marker',
      start: pos,
      text: label,
      style: { ...this.currentStyle, fillColor: MARKER_COLORS[type] },
      visible: true,
      locked: false,
      layer: this.objects.length,
    };
    this.objects.push(obj);
    this.saveToHistory();
    this.notifyChange();
    this.render();
  }

  deleteSelected(): void {
    if (this.selectedObjectId) {
      this.objects = this.objects.filter((o) => o.id !== this.selectedObjectId);
      this.selectedObjectId = null;
      this.onSelect?.(null);
      this.saveToHistory();
      this.notifyChange();
      this.render();
    }
  }

  clear(): void {
    this.objects = [];
    this.selectedObjectId = null;
    this.saveToHistory();
    this.notifyChange();
    this.render();
  }

  // ==========================================================================
  // History (Undo/Redo)
  // ==========================================================================

  private saveToHistory(): void {
    // Remove any future states if we're not at the end
    this.history = this.history.slice(0, this.historyIndex + 1);

    // Add current state
    this.history.push({
      objects: JSON.parse(JSON.stringify(this.objects)),
      timestamp: Date.now(),
    });

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  undo(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.objects = JSON.parse(JSON.stringify(this.history[this.historyIndex].objects));
      this.selectedObjectId = null;
      this.notifyChange();
      this.render();
      return true;
    }
    return false;
  }

  redo(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.objects = JSON.parse(JSON.stringify(this.history[this.historyIndex].objects));
      this.selectedObjectId = null;
      this.notifyChange();
      this.render();
      return true;
    }
    return false;
  }

  canUndo(): boolean {
    return this.historyIndex > 0;
  }

  canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  getState(): CanvasState {
    return {
      objects: JSON.parse(JSON.stringify(this.objects)),
      width: this.canvas?.width || 0,
      height: this.canvas?.height || 0,
      backgroundColor: '#000',
    };
  }

  loadState(state: CanvasState): void {
    this.objects = JSON.parse(JSON.stringify(state.objects));
    this.saveToHistory();
    this.render();
  }

  toDataURL(format: 'png' | 'jpeg' = 'png', quality: number = 0.9): string {
    if (!this.canvas) return'';
    return this.canvas.toDataURL(`image/${format}`, quality);
  }

  private notifyChange(): void {
    this.onChange?.(this.getState());
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const frameCanvasEngine = new FrameCanvasEngine();

export default frameCanvasEngine;

