/**
 * Light Diagram Generator
 * 
 * Generates 2D top-down light diagrams showing light positions, angles, and distances
 * Exports to PDF, PNG, and SVG formats
 */

import { logger } from './logger';
import * as THREE from 'three';

const log = logger.module('LightDiagramGenerator');

export interface LightInfo {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  type: 'key' | 'fill' | 'rim' | 'background' | 'other';
  power: number;
  beamAngle?: number;
  modifier?: string;
  modifierSize?: number;
  color?: string;
}

export interface LightDiagramConfig {
  width: number;
  height: number;
  scale: number; // Pixels per meter
  showDistances: boolean;
  showAngles: boolean;
  showLabels: boolean;
  backgroundColor: string;
  gridColor: string;
  subjectPosition: [number, number];
  subjectSize: number;
}

export class LightDiagramGenerator {
  private defaultConfig: LightDiagramConfig = {
    width: 800,
    height: 800,
    scale: 50, // 50 pixels per meter
    showDistances: true,
    showAngles: true,
    showLabels: true,
    backgroundColor: '#ffffff',
    gridColor: '#e0e0e0',
    subjectPosition: [400, 400],
    subjectSize: 20,
  };
  
  /**
   * Generate SVG light diagram
   */
  generateSVG(lights: LightInfo[], config: Partial<LightDiagramConfig> = {}): string {
    const cfg = { ...this.defaultConfig, ...config };
    
    const svg = [
      `<svg width="${cfg.width}" height="${cfg.height}" xmlns="http://www.w3.org/2000/svg">`,
      `<rect width="${cfg.width}" height="${cfg.height}" fill="${cfg.backgroundColor}"/>`,
      this.generateGrid(cfg),
      this.generateSubject(cfg),
      ...lights.map((light) => this.generateLightSVG(light, cfg)),
      '</svg>',
    ].join('\n');
    
    return svg;
  }
  
  /**
   * Generate PNG light diagram
   */
  async generatePNG(lights: LightInfo[], config: Partial<LightDiagramConfig> = {}): Promise<Blob> {
    const cfg = { ...this.defaultConfig, ...config };
    const canvas = document.createElement('canvas');
    canvas.width = cfg.width;
    canvas.height = cfg.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    // Draw background
    ctx.fillStyle = cfg.backgroundColor;
    ctx.fillRect(0, 0, cfg.width, cfg.height);
    
    // Draw grid
    this.drawGrid(ctx, cfg);
    
    // Draw subject
    this.drawSubject(ctx, cfg);
    
    // Draw lights
    for (const light of lights) {
      this.drawLight(ctx, light, cfg);
    }
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        }
      }, 'image/png');
    });
  }
  
  /**
   * Generate PDF light diagram
   */
  async generatePDF(lights: LightInfo[], config: Partial<LightDiagramConfig> = {}): Promise<Blob> {
    // For PDF generation, we'll use jsPDF
    // This is a simplified version - in production, you'd use jsPDF library
    const svg = this.generateSVG(lights, config);
    
    // Convert SVG to PDF (simplified - would need jsPDF in production)
    // For now, return SVG as data URL
    const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
    return svgBlob;
  }
  
  private generateGrid(config: LightDiagramConfig): string {
    const lines: string[] = [];
    const step = config.scale; // Grid step in pixels
    
    // Vertical lines
    for (let x = 0; x < config.width; x += step) {
      lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${config.height}" stroke="${config.gridColor}" stroke-width="1"/>`);
    }
    
    // Horizontal lines
    for (let y = 0; y < config.height; y += step) {
      lines.push(`<line x1="0" y1="${y}" x2="${config.width}" y2="${y}" stroke="${config.gridColor}" stroke-width="1"/>`);
    }
    
    return lines.join('\n');
  }
  
  private drawGrid(ctx: CanvasRenderingContext2D, config: LightDiagramConfig): void {
    ctx.strokeStyle = config.gridColor;
    ctx.lineWidth = 1;
    const step = config.scale;
    
    // Vertical lines
    for (let x = 0; x < config.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, config.height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y < config.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(config.width, y);
      ctx.stroke();
    }
  }
  
  private generateSubject(config: LightDiagramConfig): string {
    const [x, y] = config.subjectPosition;
    const r = config.subjectSize / 2;
    
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#333333" stroke="#000000" stroke-width="2"/>
            <text x="${x}" y="${y + r + 15}" text-anchor="middle" font-size="12" fill="#000000">Subject</text>`;
  }
  
  private drawSubject(ctx: CanvasRenderingContext2D, config: LightDiagramConfig): void {
    const [x, y] = config.subjectPosition;
    const r = config.subjectSize / 2;
    
    ctx.fillStyle = '#333333';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    if (config.showLabels) {
      ctx.fillStyle = '#000000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Subject', x, y + r + 15);
    }
  }
  
  private generateLightSVG(light: LightInfo, config: LightDiagramConfig): string {
    const [px, py] = this.worldToScreen(light.position, config);
    const [sx, sy] = config.subjectPosition;
    
    const elements: string[] = [];
    
    // Light position
    const lightColor = light.color || this.getLightColor(light.type);
    elements.push(`<circle cx="${px}" cy="${py}" r="8" fill="${lightColor}" stroke="#000000" stroke-width="2"/>`);
    
    // Line to subject
    if (config.showDistances) {
      const distance = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2) / config.scale;
      elements.push(`<line x1="${px}" y1="${py}" x2="${sx}" y2="${sy}" stroke="${lightColor}" stroke-width="2" stroke-dasharray="5,5" opacity="0.5"/>`);
      elements.push(`<text x="${(px + sx) / 2}" y="${(py + sy) / 2 - 5}" text-anchor="middle" font-size="10" fill="#666666">${distance.toFixed(1)}m</text>`);
    }
    
    // Beam angle visualization
    if (config.showAngles && light.beamAngle) {
      const angle = this.calculateLightAngle(light, config);
      const beamLength = 100;
      const halfAngle = (light.beamAngle * Math.PI) / 180 / 2;
      
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      
      const leftX = px + Math.cos(angle - halfAngle) * beamLength;
      const leftY = py + Math.sin(angle - halfAngle) * beamLength;
      const rightX = px + Math.cos(angle + halfAngle) * beamLength;
      const rightY = py + Math.sin(angle + halfAngle) * beamLength;
      
      elements.push(`<line x1="${px}" y1="${py}" x2="${leftX}" y2="${leftY}" stroke="${lightColor}" stroke-width="1" opacity="0.6"/>`);
      elements.push(`<line x1="${px}" y1="${py}" x2="${rightX}" y2="${rightY}" stroke="${lightColor}" stroke-width="1" opacity="0.6"/>`);
    }
    
    // Label
    if (config.showLabels) {
      elements.push(`<text x="${px}" y="${py - 15}" text-anchor="middle" font-size="11" font-weight="bold" fill="#000000">${light.name || light.type}</text>`);
      if (light.modifier) {
        elements.push(`<text x="${px}" y="${py + 25}" text-anchor="middle" font-size="9" fill="#666666">${light.modifier}</text>`);
      }
    }
    
    return elements.join('\n');
  }
  
  private drawLight(ctx: CanvasRenderingContext2D, light: LightInfo, config: LightDiagramConfig): void {
    const [px, py] = this.worldToScreen(light.position, config);
    const [sx, sy] = config.subjectPosition;
    
    const lightColor = light.color || this.getLightColor(light.type);
    
    // Light position
    ctx.fillStyle = lightColor;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Line to subject
    if (config.showDistances) {
      ctx.strokeStyle = lightColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;
      
      const distance = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2) / config.scale;
      ctx.fillStyle = '#666666';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${distance.toFixed(1)}m`, (px + sx) / 2, (py + sy) / 2 - 5);
    }
    
    // Beam angle
    if (config.showAngles && light.beamAngle) {
      const angle = this.calculateLightAngle(light, config);
      const beamLength = 100;
      const halfAngle = (light.beamAngle * Math.PI) / 180 / 2;
      
      ctx.strokeStyle = lightColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(angle - halfAngle) * beamLength, py + Math.sin(angle - halfAngle) * beamLength);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(angle + halfAngle) * beamLength, py + Math.sin(angle + halfAngle) * beamLength);
      ctx.stroke();
      
      ctx.globalAlpha = 1.0;
    }
    
    // Label
    if (config.showLabels) {
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(light.name || light.type, px, py - 15);
      
      if (light.modifier) {
        ctx.font = '9px Arial';
        ctx.fillStyle = '#666666';
        ctx.fillText(light.modifier, px, py + 25);
      }
    }
  }
  
  private worldToScreen(worldPos: [number, number, number], config: LightDiagramConfig): [number, number] {
    // Convert 3D world position to 2D screen position (top-down view)
    const x = config.subjectPosition[0] + worldPos[0] * config.scale;
    const y = config.subjectPosition[1] - worldPos[2] * config.scale; // Z becomes Y in top-down
    return [x, y];
  }
  
  private calculateLightAngle(light: LightInfo, config: LightDiagramConfig): number {
    const [px, py] = this.worldToScreen(light.position, config);
    const [sx, sy] = config.subjectPosition;
    
    // Calculate angle from light to subject
    return Math.atan2(sy - py, sx - px);
  }
  
  private getLightColor(type: string): string {
    const colors: Record<string, string> = {
      key: '#ffaa00',
      fill: '#00aaff',
      rim: '#ff00aa',
      background: '#aaaaaa',
      other: '#888888',
    };
    return colors[type] || colors.other;
  }
}

// Export singleton instance
export const lightDiagramGenerator = new LightDiagramGenerator();


