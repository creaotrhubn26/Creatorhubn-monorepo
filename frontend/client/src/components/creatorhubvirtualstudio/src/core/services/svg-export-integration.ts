/**
 * SVG Renderer Integration for Virtual Studio
 *
 * Connects the Virtual Studio with the main app, 's SVG Renderer service
 * to export high-quality stage diagrams and lighting layouts.
 */

import svgRenderer, { type SVGRenderOptions } from '@/services/svg-renderer';
import type { Scene } from '../models/scene';
import { logger } from './logger';

const log = logger.module('SVGExport');

let rendererReady = false;

/**
 * Initialize SVG Renderer (call once at startup)
 */
export async function initializeSVGRenderer(): Promise<void> {
  if (!rendererReady) {
    await svgRenderer.initialize();
    rendererReady = true;
    log.info('SVG Renderer ready for Virtual Studio exports, ');
  }
}

/**
 * Generate SVG representation of the current scene (top-down 2D view)
 */
export function generateSceneSVG(
  scene: Scene,
  options: {
    width?: number;
    height?: number;
    includeLabels?: boolean;
    includeMeasurements?: boolean;
    includeGrid?: boolean;
    theme?: 'light' | 'dark';
  },
): string {
  const {
    width = 1920,
    height = 1080,
    includeLabels = true,
    includeMeasurements = true,
    includeGrid = true,
    theme = 'light',
  } = options;

  const pxPerMeter = 60;
  const centerX = width / 2;
  const centerY = height * 0.55;

  // Theme colors
  const colors =
    theme === 'dark'
      ? {
          background: '#1e293b',
          grid: '#334155',
          backdrop: '#475569',
          softbox: '#3b82f6',
          umbrella: '#8b5cf6',
          spot: '#f59e0b',
          reflector: '#10b981',
          camera: '#ef4444',
          model: '#ec4899',
          text: '#f1f5f9',
          label: '#cbd5e1',
        }
      : {
          background: '#f8fafc',
          grid: '#e2e8f0',
          backdrop: '#cbd5e1',
          softbox: '#3b82f6',
          umbrella: '#8b5cf6',
          spot: '#f59e0b',
          reflector: '#10b981',
          camera: '#ef4444',
          model: '#ec4899',
          text: '#1e293b',
          label: '#64748b',
        };

  // Convert world position to SVG coordinates
  const toSVG = (x: number, z: number): [number, number] => {
    return [centerX + x * pxPerMeter, centerY - z * pxPerMeter];
  };

  // Generate SVG elements
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}, " width="${width}" height="${height}">`;

  // Background
  svg += `<rect width="${width}" height="${height}" fill="${colors.background}"/>`;

  // Grid (if enabled)
  if (includeGrid) {
    const gridSize = 32;
    svg += `<defs><pattern id="grid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">`;
    svg += `<path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="${colors.grid}" stroke-width="1"/>`;
    svg += `</pattern></defs>`;
    svg += `<rect width="${width}" height="${height}" fill="url(#grid)"/>`;
  }

  // Room/Studio boundary (if defined)
  if (scene.environment.room) {
    const room = scene.environment.room;
    const roomWidth = room.size[0] * pxPerMeter;
    const roomDepth = room.size[2] * pxPerMeter;
    const roomX = centerX - roomWidth / 2;
    const roomY = centerY - roomDepth / 2;

    svg += `<rect x="${roomX}" y="${roomY}" width="${roomWidth}" height="${roomDepth}" `;
    svg += `fill="none" stroke="${colors.label}" stroke-width="2" stroke-dasharray="10,5"/>`;

    if (includeLabels) {
      svg += `<text x="${roomX + 10}" y="${roomY + 25}" fill="${colors.label}" font-size="14" font-family="Arial">`;
      svg += `Studio ${room.size[0]}m × ${room.size[2]}m</text>`;
    }
  }

  // Backdrop
  const backdrop = scene.nodes.find((n) => n.type === 'backdrop');
  if (backdrop) {
    const [bx, by] = toSVG(backdrop.transform.position[0], backdrop.transform.position[2]);
    svg += `<rect x="${bx - 260}" y="${by - 190}" width="520" height="380" fill="${colors.backdrop}" stroke="${colors.label}" stroke-width="2" rx="8"/>`;
    if (includeLabels) {
      svg += `<text x="${bx}" y="${by}" fill="${colors.text}" font-size="16" font-weight="bold" text-anchor="middle" dominant-baseline="middle">BACKDROP</text>`;
    }
  }

  // Scene nodes
  scene.nodes.forEach((node) => {
    if (node.type === 'backdrop' || !node.visible) return;

    const [x, y] = toSVG(node.transform.position[0], node.transform.position[2]);
    const color = colors[node.type as keyof typeof colors] || colors.softbox;

    // Draw node shape
    switch (node.type) {
      case 'softbox':
        svg += `<rect x="${x - 30}" y="${y - 30}" width="60" height="60" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="3" rx="8"/>`;
        svg += `<circle cx="${x}" cy="${y}" r="8" fill="${color}"/>`;
        break;
      case 'umbrella':
        svg += `<circle cx="${x}" cy="${y}" r="31" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="3" stroke-dasharray="5,5"/>`;
        svg += `<circle cx="${x}" cy="${y}" r="8" fill="${color}"/>`;
        break;
      case 'spot':
        svg += `<circle cx="${x}" cy="${y}" r="12" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="3"/>`;
        svg += `<circle cx="${x}" cy="${y}" r="6" fill="${color}"/>`;
        break;
      case 'reflector':
        svg += `<ellipse cx="${x}" cy="${y}" rx="25" ry="15" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="3"/>`;
        break;
      case 'camera':
        svg += `<rect x="${x - 24}" y="${y - 15}" width="48" height="30" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="3" rx="4"/>`;
        svg += `<circle cx="${x}" cy="${y}" r="6" fill="${color}"/>`;
        break;
      case 'model':
        svg += `<rect x="${x - 11}" y="${y - 45}" width="22" height="90" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="3" rx="6"/>`;
        svg += `<circle cx="${x}" cy="${y - 35}" r="10" fill="${color}" fill-opacity="0.4"/>`;
        break;
    }

    // Labels
    if (includeLabels && node.name) {
      svg += `<text x="${x}" y="${y + 50}" fill="${colors.text}" font-size="12" text-anchor="middle" font-family="Arial">${node.name}</text>`;
    }

    // Power indicator for lights
    if (node.light && includeLabels) {
      const power = Math.round(node.light.power * 100);
      svg += `<text x="${x}" y="${y + 65}" fill="${colors.label}" font-size="10" text-anchor="middle" font-family="Arial">${power}% | ${node.light.cct}K</text>`;
    }

    // Selection indicator
    if (scene.selection.includes(node.id)) {
      svg += `<circle cx="${x}" cy="${y}" r="50" fill="none" stroke="#22c55e" stroke-width="3" stroke-dasharray="5,5"/>`;
    }
  });

  // Measurement lines (if enabled and available)
  if (includeMeasurements) {
    // Auto-measurements between camera and model
    const camera = scene.nodes.find((n) => n.camera);
    const model = scene.nodes.find((n) => n.type === 'model');

    if (camera && model) {
      const [cx, cy] = toSVG(camera.transform.position[0], camera.transform.position[2]);
      const [mx, my] = toSVG(model.transform.position[0], model.transform.position[2]);
      const distance = Math.hypot(
        camera.transform.position[0] - model.transform.position[0],
        camera.transform.position[2] - model.transform.position[2],
      ).toFixed(2);

      svg += `<line x1="${cx}" y1="${cy}" x2="${mx}" y2="${my}" stroke="#2563eb" stroke-width="2" stroke-dasharray="5,5"/>`;
      const midX = (cx + mx) / 2;
      const midY = (cy + my) / 2;
      svg += `<rect x="${midX - 40}" y="${midY - 12}" width="80" height="24" fill="white" stroke="#2563eb" rx="4"/>`;
      svg += `<text x="${midX}" y="${midY + 4}" fill="#2563eb" font-size="12" text-anchor="middle" font-weight="bold">${distance}m</text>`;
    }
  }

  // Legend
  if (includeLabels) {
    const legendX = width - 200;
    const legendY = 30;
    svg += `<rect x="${legendX}" y="${legendY}" width="180" height="180" fill="${colors.background}" fill-opacity="0.9" stroke="${colors.label}" stroke-width="1" rx="8"/>`;
    svg += `<text x="${legendX + 10}" y="${legendY + 20}" fill="${colors.text}" font-size="14" font-weight="bold">Legend</text>`;

    const items = [
      { label: 'Softbox', color: colors.softbox },
      { label: 'Umbrella', color: colors.umbrella },
      { label: 'Spot', color: colors.spot },
      { label: 'Reflector', color: colors.reflector },
      { label: 'Camera', color: colors.camera },
      { label: 'Model', color: colors.model },
    ];

    items.forEach((item, i) => {
      const itemY = legendY + 40 + i * 22;
      svg += `<circle cx="${legendX + 15}" cy="${itemY}" r="6" fill="${item.color}"/>`;
      svg += `<text x="${legendX + 30}" y="${itemY + 4}" fill="${colors.text}" font-size="12">${item.label}</text>`;
    });
  }

  svg += '</svg>';
  return svg;
}

/**
 * Export scene as high-quality PNG
 */
export async function exportSceneToPNG(
  scene: Scene,
  options: {
    width?: number;
    height?: number;
    format?: 'png' | 'webp';
    quality?: number;
    theme?: 'light' | 'dark';
  } = {},
): Promise<Blob> {
  await initializeSVGRenderer();

  if (!rendererReady) {
    throw new Error('SVG Renderer not initialized, ');
  }

  const svg = generateSceneSVG(scene, {
    ...options,
    includeLabels: true,
    includeMeasurements: true,
    includeGrid: true,
  });

  const renderOptions: SVGRenderOptions = {
    width: options.width || 1920,
    height: options.height || 1080,
    format: options.format || 'png',
    quality: options.quality || 90,
  };

  const result = await svgRenderer.renderSVGToPNG(svg, renderOptions);

  // Convert data URL to blob
  const response = await fetch(result.dataUrl);
  return await response.blob();
}

/**
 * Export scene as SVG file (for editing in vector graphics software)
 */
export function exportSceneToSVG(scene: Scene): Blob {
  const svg = generateSceneSVG(scene, {
    width: 1920,
    height: 1080,
    includeLabels: true,
    includeMeasurements: true,
    includeGrid: true,
    theme: 'light',
  });

  return new Blob([svg], { type: 'image/svg+xml' });
}

/**
 * Generate client-friendly lighting diagram (simplified, clean)
 */
export async function exportClientDiagram(
  scene: Scene,
  options: {
    clientName?: string;
    projectName?: string;
    date?: string;
  } = {},
): Promise<Blob> {
  // Generate a cleaner, more professional SVG for client presentations
  const svg = generateClientPresentationSVG(scene, options);

  await initializeSVGRenderer();
  if (!rendererReady) {
    throw new Error('SVG Renderer not initialized');
  }

  const renderOptions: SVGRenderOptions = {
    width: 1920,
    height: 1200,
    format: 'png',
    quality: 95,
  };

  const result = await svgRenderer.renderSVGToPNG(svg, renderOptions);

  const response = await fetch(result.dataUrl);
  return await response.blob();
}

/**
 * Generate professional client presentation SVG
 */
function generateClientPresentationSVG(
  scene: Scene,
  metadata: { clientName?: string; projectName?: string; date?: string },
): string {
  const width = 1920;
  const height = 1200;
  const diagramHeight = 900;

  // Header section
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="#ffffff"/>`;

  // Header
  svg += `<rect width="${width}" height="120" fill="#1e293b"/>`;
  svg += `<text x="40" y="60" fill="#ffffff" font-size="36" font-weight="bold" font-family="Arial">Lighting Setup Diagram</text>`;

  if (metadata.projectName) {
    svg += `<text x="40" y="95" fill="#94a3b8" font-size="18" font-family="Arial">${metadata.projectName}</text>`;
  }

  if (metadata.clientName) {
    svg += `<text x="${width - 40}" y="60" fill="#ffffff" font-size="20" text-anchor="end" font-family="Arial">${metadata.clientName}</text>`;
  }

  if (metadata.date) {
    svg += `<text x="${width - 40}" y="95" fill="#94a3b8" font-size="16" text-anchor="end" font-family="Arial">${metadata.date}</text>`;
  }

  // Main diagram (reuse existing generator but adjusted for client view)
  const mainSVG = generateSceneSVG(scene, {
    width,
    height: diagramHeight,
    includeLabels: true,
    includeMeasurements: true,
    includeGrid: false,
    theme: 'light',
  });

  // Extract content from main SVG (skip wrapping <svg> tags)
  const svgContent = mainSVG.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');
  svg += `<g transform="translate(0, 120)">${svgContent}</g>`;

  // Equipment list
  const lights = scene.nodes.filter(
    (n) =>
      (n.type === 'softbox' ||
        n.type === 'umbrella' ||
        n.type === 'spot' ||
        n.type === 'reflector') &&
      n.visible,
  );

  svg += `<rect x="40" y="1050" width="800" height="${30 + lights.length * 30}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2" rx="8"/>`;
  svg += `<text x="60" y="1075" fill="#1e293b" font-size="18" font-weight="bold">Equipment List</text>`;

  lights.forEach((light, i) => {
    const y = 1105 + i * 30;
    const power = light.light ? Math.round(light.light.power * 100) : 0;
    const cct = light.light?.cct || 5600;
    svg += `<text x="60" y="${y}" fill="#475569" font-size="14">• ${light.name || light.type} - ${power}% Power, ${cct}K</text>`;
  });

  svg +='</svg>';
  return svg;
}
