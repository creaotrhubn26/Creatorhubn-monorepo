/**
 * ExportOptions - Export storyboard frames to various formats
 * 
 * Features:
 * - PSD export with layers preserved
 * - SVG export for vector graphics
 * - PDF export with multiple pages
 * - PNG/JPEG with quality settings
 * - Batch export multiple frames
 * - Resolution scaling options
 * - Custom file naming
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Divider,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Chip,
  Alert,
} from '@mui/material';
import {
  FileDownload,
  Image,
  PictureAsPdf,
  Layers,
  Settings,
  Folder,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// =============================================================================
// Types
// =============================================================================

export type ExportFormat = 'png' | 'jpeg' | 'svg' | 'pdf' | 'psd';

export interface ExportSettings {
  format: ExportFormat;
  quality: number;           // 0-100 for JPEG
  scale: number;             // 1x, 2x, 3x, etc.
  includeBackground: boolean;
  preserveLayers: boolean;   // For PSD export
  embedFonts: boolean;       // For SVG/PDF
  colorProfile: 'sRGB' | 'AdobeRGB' | 'P3';
  fileNamePattern: string;   // e.g., "frame_{index}_{timestamp}"
}

export interface ExportFrame {
  index: number;
  name?: string;
  canvas: HTMLCanvasElement;
  layers?: Array<{
    name: string;
    canvas: HTMLCanvasElement;
    opacity: number;
    blendMode: string;
    visible: boolean;
  }>;
}

export interface ExportOptionsProps {
  frames: ExportFrame[];
  selectedFrameIndices: number[];
  onExport: (settings: ExportSettings, frameIndices: number[]) => Promise<void>;
  isExporting?: boolean;
  exportProgress?: number;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  size?: number;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'png',
  quality: 90,
  scale: 1,
  includeBackground: true,
  preserveLayers: true,
  embedFonts: true,
  colorProfile: 'sRGB',
  fileNamePattern: 'storyboard_frame_{index}',
};

const FORMAT_INFO: Record<ExportFormat, { 
  label: string; 
  icon: React.ReactNode; 
  description: string;
  supportsLayers: boolean;
  supportsTransparency: boolean;
}> = {
  png: {
    label: 'PNG',
    icon: <Image />,
    description: 'Lossless with transparency',
    supportsLayers: false,
    supportsTransparency: true,
  },
  jpeg: {
    label: 'JPEG',
    icon: <Image />,
    description: 'Compressed, no transparency',
    supportsLayers: false,
    supportsTransparency: false,
  },
  svg: {
    label: 'SVG',
    icon: <Image />,
    description: 'Vector graphics (shapes/text only)',
    supportsLayers: true,
    supportsTransparency: true,
  },
  pdf: {
    label: 'PDF',
    icon: <PictureAsPdf />,
    description: 'Multi-page document',
    supportsLayers: true,
    supportsTransparency: true,
  },
  psd: {
    label: 'PSD',
    icon: <Layers />,
    description: 'Photoshop with layers',
    supportsLayers: true,
    supportsTransparency: true,
  },
};

const SCALE_OPTIONS = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 4, label: '4x' },
];

// =============================================================================
// Styled Components
// =============================================================================

const ExportContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: 'rgba(20, 20, 30, 0.95)',
  backdropFilter: 'blur(12px)',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.08)',
  minWidth: 320,
}));

const FormatCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ selected }) => ({
  padding: 12,
  borderRadius: 8,
  cursor: 'pointer',
  backgroundColor: selected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
  border: `2px solid ${selected ? '#3b82f6' : 'transparent'}`,
  transition: 'all 0.15s',
  '&:hover': {
    backgroundColor: selected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.06)',
  },
}));

// =============================================================================
// Export Utilities
// =============================================================================

/**
 * Generate filename from pattern
 */
export function generateFilename(
  pattern: string,
  index: number,
  format: ExportFormat,
  name?: string
): string {
  const timestamp = Date.now();
  const date = new Date().toISOString().split('T')[0];
  
  return pattern
    .replace('{index}', String(index + 1).padStart(3, '0'))
    .replace('{timestamp}', String(timestamp))
    .replace('{date}', date)
    .replace('{name}', name || `frame_${index + 1}`)
    + `.${format}`;
}

/**
 * Export single frame as PNG/JPEG
 */
export async function exportAsImage(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg',
  quality: number,
  scale: number,
  includeBackground: boolean
): Promise<Blob> {
  // Create scaled canvas
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = canvas.width * scale;
  scaledCanvas.height = canvas.height * scale;
  
  const ctx = scaledCanvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  
  // Fill background for JPEG
  if (format === 'jpeg' || includeBackground) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, scaledCanvas.width, scaledCanvas.height);
  }
  
  // Scale and draw
  ctx.scale(scale, scale);
  ctx.drawImage(canvas, 0, 0);
  
  // Convert to blob
  return new Promise((resolve, reject) => {
    scaledCanvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create image blob'));
      },
      `image/${format}`,
      quality / 100
    );
  });
}

/**
 * Export as SVG with embedded raster strokes and vector shapes
 * Shapes are real SVG elements; strokes are embedded as raster <image>.
 */
export function exportAsSVG(
  canvas: HTMLCanvasElement,
  _scale: number,
  shapes?: Array<{
    type: string;
    x: number; y: number;
    width: number; height: number;
    rotation: number;
    style: {
      fillColor: string; fillOpacity: number;
      strokeColor: string; strokeWidth: number;
      strokeOpacity: number; cornerRadius?: number;
      sides?: number; points?: number;
    };
    x2?: number; y2?: number;
  }>
): string {
  const w = canvas.width;
  const h = canvas.height;
  const dataUrl = canvas.toDataURL('image/png');
  
  // Build vector shapes
  let shapeElements = '';
  if (shapes && shapes.length > 0) {
    shapes.forEach(s => {
      const transform = s.rotation ? ` transform="rotate(${s.rotation} ${s.x + s.width / 2} ${s.y + s.height / 2})"` : '';
      const fill = `fill="${s.style.fillColor}" fill-opacity="${s.style.fillOpacity}"`;
      const stroke = `stroke="${s.style.strokeColor}" stroke-width="${s.style.strokeWidth}" stroke-opacity="${s.style.strokeOpacity}"`;
      const attrs = `${fill} ${stroke}${transform}`;

      switch (s.type) {
        case 'rectangle': {
          const rx = s.style.cornerRadius || 0;
          shapeElements += `  <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${rx}" ${attrs}/>\n`;
          break;
        }
        case 'ellipse':
          shapeElements += `  <ellipse cx="${s.x + s.width / 2}" cy="${s.y + s.height / 2}" rx="${s.width / 2}" ry="${s.height / 2}" ${attrs}/>\n`;
          break;
        case 'line':
          shapeElements += `  <line x1="${s.x}" y1="${s.y}" x2="${s.x2 ?? s.x + s.width}" y2="${s.y2 ?? s.y + s.height}" ${stroke}${transform}/>\n`;
          break;
        case 'arrow': {
          const x2 = s.x2 ?? s.x + s.width;
          const y2 = s.y2 ?? s.y + s.height;
          shapeElements += `  <defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="${s.style.strokeColor}"/></marker></defs>\n`;
          shapeElements += `  <line x1="${s.x}" y1="${s.y}" x2="${x2}" y2="${y2}" ${stroke} marker-end="url(#arrowhead)"${transform}/>\n`;
          break;
        }
        case 'triangle': {
          const cx = s.x + s.width / 2;
          const pts = `${cx},${s.y} ${s.x},${s.y + s.height} ${s.x + s.width},${s.y + s.height}`;
          shapeElements += `  <polygon points="${pts}" ${attrs}/>\n`;
          break;
        }
        case 'star': {
          const numPts = s.style.points ?? 5;
          const cx = s.x + s.width / 2;
          const cy = s.y + s.height / 2;
          const outerR = Math.min(s.width, s.height) / 2;
          const innerR = outerR * 0.4;
          const starPts: string[] = [];
          for (let i = 0; i < numPts * 2; i++) {
            const angle = (i * Math.PI) / numPts - Math.PI / 2;
            const r = i % 2 === 0 ? outerR : innerR;
            starPts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
          }
          shapeElements += `  <polygon points="${starPts.join(' ')}" ${attrs}/>\n`;
          break;
        }
        case 'polygon': {
          const sides = s.style.sides ?? 6;
          const cx = s.x + s.width / 2;
          const cy = s.y + s.height / 2;
          const r = Math.min(s.width, s.height) / 2;
          const polyPts: string[] = [];
          for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
            polyPts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
          }
          shapeElements += `  <polygon points="${polyPts.join(' ')}" ${attrs}/>\n`;
          break;
        }
      }
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${w}" 
     height="${h}"
     viewBox="0 0 ${w} ${h}">
  <image xlink:href="${dataUrl}" 
         width="${w}" 
         height="${h}"/>
${shapeElements}</svg>`;
}

/**
 * Export as PDF — builds a minimal PDF 1.4 binary with each frame as
 * a JPEG-compressed page image. No external libraries required.
 */
export async function exportAsPDF(
  frames: ExportFrame[],
  settings: ExportSettings
): Promise<Blob> {
  // Helper: convert a canvas to JPEG bytes
  async function canvasToJpegBytes(canvas: HTMLCanvasElement, quality: number, scale: number): Promise<Uint8Array> {
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = canvas.width * scale;
    scaledCanvas.height = canvas.height * scale;
    const ctx = scaledCanvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, scaledCanvas.width, scaledCanvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(canvas, 0, 0);

    return new Promise((resolve, reject) => {
      scaledCanvas.toBlob(
        async (blob) => {
          if (!blob) return reject(new Error('toBlob failed'));
          resolve(new Uint8Array(await blob.arrayBuffer()));
        },
        'image/jpeg',
        quality / 100
      );
    });
  }

  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;

  const write = (s: string) => { const b = enc.encode(s); parts.push(b); pos += b.length; };
  const writeBytes = (b: Uint8Array) => { parts.push(b); pos += b.length; };
  const markObj = () => { offsets.push(pos); };

  // ── Header ──
  write('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');

  const pageCount = frames.length;
  const imageObjStart = 4; // Objects 1=Catalog 2=Pages 3=Font — images start at 4

  // ── Object 1: Catalog ──
  markObj();
  write('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // ── Object 2: Pages (placeholder — written later) ──
  markObj();
  const pagesObjOffset = pos;
  // Reserve space for the Pages object — we'll overwrite below
  const pagesPlaceholder = '2 0 obj\n<< /Type /Pages /Kids [' +
    frames.map((_, i) => `${imageObjStart + i * 2 + 1} 0 R`).join(' ') +
    `] /Count ${pageCount} >>\nendobj\n`;
  write(pagesPlaceholder);

  // ── Object 3: Font (basic) ──
  markObj();
  write('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  // ── Per-page: Image XObject + Page ──
  for (let p = 0; p < pageCount; p++) {
    const frame = frames[p];
    const imgBytes = await canvasToJpegBytes(frame.canvas, settings.quality, settings.scale);
    const pw = frame.canvas.width * settings.scale;
    const ph = frame.canvas.height * settings.scale;

    // Image XObject
    const imgObjNum = imageObjStart + p * 2;
    markObj();
    write(`${imgObjNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pw} /Height ${ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`);
    writeBytes(imgBytes);
    write('\nendstream\nendobj\n');

    // Page
    const pageObjNum = imgObjNum + 1;
    markObj();
    write(`${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Contents ${pageObjNum + pageCount * 2} 0 R /Resources << /XObject << /Img${p} ${imgObjNum} 0 R >> >> >>\nendobj\n`);
  }

  // ── Content streams (draw the image) ──
  for (let p = 0; p < pageCount; p++) {
    const pw = frames[p].canvas.width * settings.scale;
    const ph = frames[p].canvas.height * settings.scale;
    const stream = `q\n${pw} 0 0 ${ph} 0 0 cm\n/Img${p} Do\nQ\n`;
    const streamObjNum = imageObjStart + pageCount * 2 + p;
    markObj();
    write(`${streamObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);
  }

  // ── Cross-reference table ──
  const xrefPos = pos;
  const totalObjs = offsets.length + 1; // +1 for obj 0
  write(`xref\n0 ${totalObjs}\n`);
  write('0000000000 65535 f \n');
  for (const off of offsets) {
    write(String(off).padStart(10, '0') + ' 00000 n \n');
  }

  // ── Trailer ──
  write(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  // Concatenate all parts into a single ArrayBuffer
  const totalLen = parts.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  // Suppress unused variable lint for pagesObjOffset (written structurally)
  void pagesObjOffset;

  return new Blob([result], { type: 'application/pdf' });
}

/**
 * Export as PSD with layers — builds a minimal Photoshop Document binary.
 *
 * PSD format structure:
 *   1. File header (magic, version, channels, dimensions, depth, mode)
 *   2. Color mode data (empty for RGB)
 *   3. Image resources section
 *   4. Layer & mask info (per-layer records + channel image data)
 *   5. Merged image data (flat composite)
 *
 * Each layer's pixel data is stored as raw (PackBits compression flag = 0).
 */
export async function exportAsPSD(
  frame: ExportFrame,
  settings: ExportSettings
): Promise<Blob> {
  const w = Math.round(frame.canvas.width * settings.scale);
  const h = Math.round(frame.canvas.height * settings.scale);
  const numChannels = 4; // RGBA

  // Scale the main canvas
  function scaleCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return src;
    ctx.drawImage(src, 0, 0, w, h);
    return c;
  }

  // Gather layers (or synthesise a single layer from the composite)
  interface PsdLayer {
    name: string;
    opacity: number;
    visible: boolean;
    pixels: Uint8ClampedArray;
  }

  const layers: PsdLayer[] = [];
  if (frame.layers && frame.layers.length > 0 && settings.preserveLayers) {
    for (const l of frame.layers) {
      const scaled = scaleCanvas(l.canvas);
      const ctx = scaled.getContext('2d');
      if (!ctx) continue;
      const imgData = ctx.getImageData(0, 0, w, h);
      layers.push({
        name: l.name.substring(0, 255),
        opacity: Math.round(l.opacity * 255),
        visible: l.visible,
        pixels: imgData.data,
      });
    }
  }
  if (layers.length === 0) {
    const scaled = scaleCanvas(frame.canvas);
    const ctx = scaled.getContext('2d');
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, w, h);
      layers.push({ name: 'Layer 1', opacity: 255, visible: true, pixels: imgData.data });
    }
  }

  // Also need the composite (flattened) image
  const compositeCanvas = scaleCanvas(frame.canvas);
  const compositeCtx = compositeCanvas.getContext('2d');
  const compositePixels = compositeCtx
    ? compositeCtx.getImageData(0, 0, w, h).data
    : new Uint8ClampedArray(w * h * 4);

  // ── Binary helpers ──
  class PsdWriter {
    readonly parts: Uint8Array[] = [];
    private len = 0;

    u8(v: number) { const b = new Uint8Array([v & 0xff]); this.parts.push(b); this.len += 1; }
    u16(v: number) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v); this.parts.push(b); this.len += 2; }
    u32(v: number) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v); this.parts.push(b); this.len += 4; }
    bytes(data: Uint8Array) { this.parts.push(data); this.len += data.length; }
    ascii(s: string) { const b = new TextEncoder().encode(s); this.parts.push(b); this.len += b.length; }
    pad(n: number) { if (n > 0) { const b = new Uint8Array(n); this.parts.push(b); this.len += n; } }
    get length() { return this.len; }

    /** Write a pascal string (length-prefixed, padded to even) */
    pascalStr(s: string) {
      const b = new TextEncoder().encode(s.substring(0, 255));
      this.u8(b.length);
      this.bytes(b);
      if ((b.length + 1) % 2 !== 0) this.pad(1);
    }

    toBlob(): Blob {
      return new Blob(this.parts, { type: 'image/vnd.adobe.photoshop' });
    }
  }

  const pw = new PsdWriter();

  // 1. ── File Header ──
  pw.ascii('8BPS');       // Signature
  pw.u16(1);              // Version
  pw.pad(6);              // Reserved
  pw.u16(numChannels);    // Channels
  pw.u32(h);              // Height
  pw.u32(w);              // Width
  pw.u16(8);              // Bits per channel
  pw.u16(3);              // Color mode: RGB

  // 2. ── Color Mode Data ──
  pw.u32(0);              // Length = 0 for RGB

  // 3. ── Image Resources ──
  pw.u32(0);              // Length = 0

  // 4. ── Layer and Mask Information ──
  // Build layer section into a sub-writer so we can get its length
  const layerInfoWriter = new PsdWriter();

  // Layer count
  layerInfoWriter.u16(layers.length);

  // Channel data per layer (raw, no compression)
  const channelDataChunks: Uint8Array[][] = []; // per layer, per channel

  for (const layer of layers) {
    // Layer record
    layerInfoWriter.u32(0);    // Top
    layerInfoWriter.u32(0);    // Left
    layerInfoWriter.u32(h);    // Bottom
    layerInfoWriter.u32(w);    // Right

    layerInfoWriter.u16(numChannels);

    // Extract channels (R, G, B, A) as planar data
    const chData: Uint8Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      const plane = new Uint8Array(w * h);
      const channelId = ch === 3 ? -1 : ch; // -1 = transparency mask in PSD
      void channelId;
      for (let i = 0; i < w * h; i++) {
        plane[i] = layer.pixels[i * 4 + ch];
      }
      chData.push(plane);
      // Channel info: id + length (2 bytes compression header + raw data)
      const chId = ch === 3 ? -1 : ch;
      layerInfoWriter.u16(chId & 0xffff);  // Channel ID
      layerInfoWriter.u32(plane.length + 2); // Data length (raw + compression marker)
    }
    channelDataChunks.push(chData);

    // Blend mode signature
    layerInfoWriter.ascii('8BIM');
    layerInfoWriter.ascii('norm');  // Normal blend
    layerInfoWriter.u8(layer.opacity);  // Opacity
    layerInfoWriter.u8(0);              // Clipping
    layerInfoWriter.u8(layer.visible ? 0 : 2); // Flags: bit 1 = hidden
    layerInfoWriter.u8(0);              // Filler

    // Extra data length (just layer name as pascal string)
    const nameBytes = new TextEncoder().encode(layer.name.substring(0, 255));
    const pascalLen = 1 + nameBytes.length + ((nameBytes.length + 1) % 2 !== 0 ? 1 : 0);
    const extraLen = 4 + 4 + pascalLen; // mask data (4) + blending ranges (4) + name
    layerInfoWriter.u32(extraLen);
    layerInfoWriter.u32(0);  // Layer mask data size = 0
    layerInfoWriter.u32(0);  // Layer blending ranges size = 0
    layerInfoWriter.pascalStr(layer.name);
  }

  // Channel image data for each layer
  for (const chData of channelDataChunks) {
    for (const plane of chData) {
      layerInfoWriter.u16(0);  // Compression = raw
      layerInfoWriter.bytes(plane);
    }
  }

  // Write the layer info section
  const layerInfoLen = layerInfoWriter.length;
  // Pad layer info to even
  const layerInfoPad = layerInfoLen % 2;

  // Total layer & mask section length
  pw.u32(layerInfoLen + 4 + layerInfoPad); // +4 for the layer info length field itself
  pw.u32(layerInfoLen);
  // Write the sub-writer's layer data parts
  for (const part of layerInfoWriter.parts) {
    pw.bytes(part);
  }
  if (layerInfoPad) pw.pad(1);

  // 5. ── Merged (composite) Image Data ──
  pw.u16(0);  // Compression = raw
  // Write planar channels: R, G, B, A
  for (let ch = 0; ch < numChannels; ch++) {
    const plane = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      plane[i] = compositePixels[i * 4 + ch];
    }
    pw.bytes(plane);
  }

  return pw.toBlob();
}

/**
 * Trigger file download
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // B-10 fix: Delay revoke so the browser has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Download text as file
 */
export function downloadText(text: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([text], { type: mimeType });
  downloadBlob(blob, filename);
}

// =============================================================================
// Component
// =============================================================================

export const ExportOptions: React.FC<ExportOptionsProps> = ({
  frames,
  selectedFrameIndices,
  onExport,
  isExporting = false,
  exportProgress = 0,
}) => {
  const [settings, setSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exportAll, setExportAll] = useState(false);

  const updateSettings = useCallback((updates: Partial<ExportSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const frameCount = exportAll ? frames.length : selectedFrameIndices.length;
  const formatInfo = FORMAT_INFO[settings.format];

  const estimatedSize = useMemo(() => {
    const baseSize = settings.format === 'jpeg' 
      ? 100 * settings.quality / 100  // ~100KB base for JPEG
      : 300;  // ~300KB base for PNG
    
    return baseSize * settings.scale * settings.scale * frameCount;
  }, [settings.format, settings.quality, settings.scale, frameCount]);

  const handleExport = useCallback(async () => {
    const indices = exportAll 
      ? frames.map((_, i) => i) 
      : selectedFrameIndices;
    
    await onExport(settings, indices);
  }, [exportAll, frames, selectedFrameIndices, settings, onExport]);

  return (
    <ExportContainer>
      {/* Header */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <FileDownload sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Export Options
          </Typography>
        </Stack>
      </Box>

      {/* Format selection */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
          Export Format
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {(Object.entries(FORMAT_INFO) as [ExportFormat, typeof FORMAT_INFO['png']][]).map(([format, info]) => (
            <FormatCard
              key={format}
              selected={settings.format === format}
              onClick={() => updateSettings({ format })}
            >
              <Stack alignItems="center" spacing={0.5}>
                <Box sx={{ color: settings.format === format ? 'primary.main' : 'text.secondary' }}>
                  {info.icon}
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 11 }}>
                  {info.label}
                </Typography>
              </Stack>
            </FormatCard>
          ))}
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
          {formatInfo.description}
        </Typography>
      </Box>

      {/* Quality slider (for JPEG) */}
      {settings.format === 'jpeg' && (
        <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption">Quality</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {settings.quality}%
            </Typography>
          </Stack>
          <Slider
            size="small"
            min={10}
            max={100}
            value={settings.quality}
            onChange={(_, v) => updateSettings({ quality: v as number })}
          />
        </Box>
      )}

      {/* Scale selection */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
          Resolution Scale
        </Typography>
        <Stack direction="row" spacing={0.5}>
          {SCALE_OPTIONS.map(option => (
            <Chip
              key={option.value}
              label={option.label}
              size="small"
              onClick={() => updateSettings({ scale: option.value })}
              sx={{
                bgcolor: settings.scale === option.value ? 'rgba(59,130,246,0.3)' : 'transparent',
                border: settings.scale === option.value 
                  ? '1px solid rgba(59,130,246,0.5)' 
                  : '1px solid rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </Stack>
        {frames[0] && (
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
            Output: {frames[0].canvas.width * settings.scale} × {frames[0].canvas.height * settings.scale}px
          </Typography>
        )}
      </Box>

      {/* Frame selection */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={exportAll}
              onChange={(e) => setExportAll(e.target.checked)}
            />
          }
          label={
            <Typography variant="body2" sx={{ fontSize: 12 }}>
              Export all frames ({frames.length})
            </Typography>
          }
        />
        {!exportAll && selectedFrameIndices.length === 0 && (
          <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
            <Typography variant="caption">No frames selected</Typography>
          </Alert>
        )}
      </Box>

      {/* Advanced options */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Stack 
          direction="row" 
          alignItems="center" 
          justifyContent="space-between"
          onClick={() => setShowAdvanced(!showAdvanced)}
          sx={{ cursor: 'pointer' }}
        >
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Settings sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption">Advanced Options</Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {showAdvanced ? '▲' : '▼'}
          </Typography>
        </Stack>
        
        {showAdvanced && (
          <Box sx={{ mt: 1.5 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={settings.includeBackground}
                  onChange={(e) => updateSettings({ includeBackground: e.target.checked })}
                />
              }
              label={<Typography variant="caption">Include background</Typography>}
            />
            
            {formatInfo.supportsLayers && (
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={settings.preserveLayers}
                    onChange={(e) => updateSettings({ preserveLayers: e.target.checked })}
                  />
                }
                label={<Typography variant="caption">Preserve layers</Typography>}
              />
            )}
            
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel sx={{ fontSize: 12 }}>Color Profile</InputLabel>
              <Select
                value={settings.colorProfile}
                label="Color Profile"
                onChange={(e) => updateSettings({ colorProfile: e.target.value as ExportSettings['colorProfile'] })}
                sx={{ fontSize: 12 }}
              >
                <MenuItem value="sRGB">sRGB</MenuItem>
                <MenuItem value="AdobeRGB">Adobe RGB</MenuItem>
                <MenuItem value="P3">Display P3</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              size="small"
              label="Filename Pattern"
              value={settings.fileNamePattern}
              onChange={(e) => updateSettings({ fileNamePattern: e.target.value })}
              helperText="Use {index}, {date}, {name}, {timestamp}"
              sx={{ mt: 1.5 }}
              InputProps={{ sx: { fontSize: 12 } }}
              FormHelperTextProps={{ sx: { fontSize: 10 } }}
            />
          </Box>
        )}
      </Box>

      {/* Export summary */}
      <Box sx={{ p: 1.5, bgcolor: 'rgba(0,0,0,0.2)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {frameCount} frame{frameCount !== 1 ? 's' : ''} • ~{Math.round(estimatedSize)}KB
          </Typography>
          <Stack direction="row" spacing={0.5}>
            {formatInfo.supportsTransparency && (
              <Chip size="small" label="α" sx={{ height: 16, fontSize: 9 }} />
            )}
            {formatInfo.supportsLayers && settings.preserveLayers && (
              <Chip size="small" label="Layers" sx={{ height: 16, fontSize: 9 }} />
            )}
          </Stack>
        </Stack>
        
        {isExporting && (
          <Box sx={{ mb: 1.5 }}>
            <LinearProgress 
              variant="determinate" 
              value={exportProgress} 
              sx={{ borderRadius: 1 }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
              Exporting... {Math.round(exportProgress)}%
            </Typography>
          </Box>
        )}
        
        <Button
          fullWidth
          variant="contained"
          startIcon={<FileDownload />}
          onClick={handleExport}
          disabled={isExporting || (frameCount === 0)}
        >
          Export {settings.format.toUpperCase()}
        </Button>
      </Box>
    </ExportContainer>
  );
};

export default ExportOptions;
