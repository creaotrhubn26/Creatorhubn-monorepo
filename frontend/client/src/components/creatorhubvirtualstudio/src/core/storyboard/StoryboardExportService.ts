/**
 * StoryboardExportService - Export storyboards to various formats
 * 
 * Supports:
 * - PDF export (multi-page document)
 * - PNG export (individual frames or contact sheet)
 * - Video export (animatic with transitions)
 */

import type { Storyboard} from '../../state/storyboardStore';
import { StoryboardFrame, getShotTypeLabel } from '../../state/storyboardStore';
import { logger } from '../services/logger';

const log = logger.module('StoryboardExport, ');

// =============================================================================
// Types
// =============================================================================

export type ExportFormat = 'pdf' | 'png' | 'png-contact' | 'video';

export interface ExportOptions {
  format: ExportFormat;
  
  // PDF options
  pdfLayout?: 'grid' | 'single' | 'technical';
  pdfPageSize?: 'A4' | 'Letter' | 'A3';
  pdfOrientation?: 'portrait' | 'landscape';
  includeTechnicalInfo?: boolean;
  includeNotes?: boolean;
  includeTimecodes?: boolean;
  
  // PNG options
  pngScale?: number;
  pngQuality?: number;
  contactSheetColumns?: number;
  
  // Video options
  videoWidth?: number;
  videoHeight?: number;
  videoFps?: number;
  videoQuality?: 'low' | 'medium' | 'high' | 'max';
  transitionType?: 'cut' | 'fade' | 'dissolve';
  transitionDuration?: number;
  optimizeForStreaming?: boolean; // Enable moov atom optimization (fast-start)
  
  // Common
  watermark?: string;
}

export interface ExportProgress {
  stage: 'preparing' | 'rendering' | 'encoding' | 'finalizing';
  progress: number; // 0-100
  currentFrame?: number;
  totalFrames?: number;
  message?: string;
}

export type ProgressCallback = (progress: ExportProgress) => void;

export interface ExportResult {
  success: boolean;
  blob?: Blob;
  url?: string;
  filename?: string;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const PDF_PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89 }, // points
  Letter: { width: 612, height: 792 },
  A3: { width: 841.89, height: 1190.55 },
};

// =============================================================================
// StoryboardExportService Class
// =============================================================================

export class StoryboardExportService {
  // =========================================================================
  // Main Export Method
  // =========================================================================

  async export(
    storyboard: Storyboard,
    options: ExportOptions,
    onProgress?: ProgressCallback
  ): Promise<ExportResult> {
    const notify = (progress: ExportProgress) => {
      onProgress?.(progress);
    };

    try {
      switch (options.format) {
        case 'pdf':
          return await this.exportPDF(storyboard, options, notify);
        case 'png':
          return await this.exportPNG(storyboard, options, notify);
        case 'png-contact':
          return await this.exportContactSheet(storyboard, options, notify);
        case 'video':
          return await this.exportVideo(storyboard, options, notify);
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }
    } catch (error) {
      log.error('Export failed: ', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =========================================================================
  // PDF Export
  // =========================================================================

  private async exportPDF(
    storyboard: Storyboard,
    options: ExportOptions,
    notify: ProgressCallback
  ): Promise<ExportResult> {
    notify({ stage: 'preparing,', progress: 0, message: 'Preparing PDF...' });

    // Dynamic import of jsPDF (if available)
    let jsPDF: any;
    try {
      const module = await import('jspdf');
      jsPDF = module.jsPDF || module.default;
    } catch {
      // Fallback to basic blob export
      return this.exportPDFBasic(storyboard, options, notify);
    }

    const pageSize = PDF_PAGE_SIZES[options.pdfPageSize || 'A4'];
    const isLandscape = options.pdfOrientation === 'landscape';
    const width = isLandscape ? pageSize.height : pageSize.width;
    const height = isLandscape ? pageSize.width : pageSize.height;

    const doc = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'pt',
      format: options.pdfPageSize?.toLowerCase() || 'a4',
    });

    const margin = 40;
    const usableWidth = width - margin * 2;
    const usableHeight = height - margin * 2;

    // Title page
    doc.setFontSize(24);
    doc.text(storyboard.name, width / 2, 100, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`${storyboard.frames.length} frames`, width / 2, 130, { align: 'center' });
    doc.text(new Date().toLocaleDateString(), width / 2, 150, { align: 'center' });

    const layout = options.pdfLayout || 'grid';

    if (layout === 'grid') {
      await this.renderGridLayout(doc, storyboard, options, notify, {
        width,
        height,
        margin,
        usableWidth,
        usableHeight,
      });
    } else if (layout === 'single') {
      await this.renderSingleLayout(doc, storyboard, options, notify, {
        width,
        height,
        margin,
        usableWidth,
        usableHeight,
      });
    } else if (layout === 'technical') {
      await this.renderTechnicalLayout(doc, storyboard, options, notify, {
        width,
        height,
        margin,
        usableWidth,
        usableHeight,
      });
    }

    notify({ stage: 'finalizing', progress: 95, message: 'Finalizing PDF...' });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const filename = `${storyboard.name.replace(/\s+/g, '_')}_storyboard.pdf`;

    notify({ stage: 'finalizing', progress: 100, message: 'Complete!' });

    return { success: true, blob, url, filename };
  }

  private async renderGridLayout(
    doc: any,
    storyboard: Storyboard,
    options: ExportOptions,
    notify: ProgressCallback,
    dims: { width: number; height: number; margin: number; usableWidth: number; usableHeight: number }
  ) {
    const { width, margin, usableWidth, usableHeight } = dims;
    const cols = 3;
    const rows = 3;
    const framesPerPage = cols * rows;
    const cellWidth = usableWidth / cols;
    const cellHeight = usableHeight / rows;
    const imageHeight = cellHeight * 0.7;
    const imageWidth = imageHeight * (16 / 9);

    const totalPages = Math.ceil(storyboard.frames.length / framesPerPage);

    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
      if (pageNum > 0) {
        doc.addPage();
      } else {
        doc.addPage(); // Skip title page
      }

      const startIdx = pageNum * framesPerPage;
      const endIdx = Math.min(startIdx + framesPerPage, storyboard.frames.length);

      for (let i = startIdx; i < endIdx; i++) {
        const frame = storyboard.frames[i];
        const localIdx = i - startIdx;
        const col = localIdx % cols;
        const row = Math.floor(localIdx / cols);

        const x = margin + col * cellWidth;
        const y = margin + row * cellHeight;

        notify({
          stage: 'rendering',
          progress: Math.round((i / storyboard.frames.length) * 90),
          currentFrame: i + 1,
          totalFrames: storyboard.frames.length,
          message: `Rendering frame ${i + 1} of ${storyboard.frames.length}`,
        });

        // Draw frame image
        try {
          const imgData = await this.loadImageAsBase64(frame.imageUrl);
          const imgX = x + (cellWidth - imageWidth) / 2;
          doc.addImage(imgData, 'JPEG', imgX, y, imageWidth, imageHeight);
        } catch {
          // Draw placeholder
          doc.setDrawColor(100);
          doc.rect(x + (cellWidth - imageWidth) / 2, y, imageWidth, imageHeight);
        }

        // Frame number
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(`${frame.index + 1}`, x + 5, y + 12);

        // Title and info below image
        const textY = y + imageHeight + 10;
        doc.setFontSize(9);
        doc.text(frame.title, x + 5, textY, { maxWidth: cellWidth - 10 });
        
        doc.setFontSize(7);
        doc.setTextColor(100);
        doc.text(`${frame.shotType} • ${frame.duration}s`, x + 5, textY + 12);
        doc.setTextColor(0);
      }
    }
  }

  private async renderSingleLayout(
    doc: any,
    storyboard: Storyboard,
    options: ExportOptions,
    notify: ProgressCallback,
    dims: { width: number; height: number; margin: number; usableWidth: number; usableHeight: number }
  ) {
    const { width, height, margin, usableWidth, usableHeight } = dims;

    for (let i = 0; i < storyboard.frames.length; i++) {
      doc.addPage();
      const frame = storyboard.frames[i];

      notify({
        stage: 'rendering',
        progress: Math.round((i / storyboard.frames.length) * 90),
        currentFrame: i + 1,
        totalFrames: storyboard.frames.length,
        message: `Rendering frame ${i + 1}`,
      });

      // Large frame image
      const imgHeight = usableHeight * 0.6;
      const imgWidth = imgHeight * (16 / 9);
      const imgX = (width - imgWidth) / 2;
      const imgY = margin;

      try {
        const imgData = await this.loadImageAsBase64(frame.imageUrl);
        doc.addImage(imgData, 'JPEG', imgX, imgY, imgWidth, imgHeight);
      } catch {
        doc.setDrawColor(100);
        doc.rect(imgX, imgY, imgWidth, imgHeight);
      }

      // Frame info
      let textY = imgY + imgHeight + 20;
      doc.setFontSize(14);
      doc.text(`${frame.index + 1}. ${frame.title}`, margin, textY);
      
      textY += 20;
      doc.setFontSize(10);
      doc.text(`Shot Type: ${getShotTypeLabel(frame.shotType)}`, margin, textY);
      doc.text(`Camera: ${frame.cameraAngle}`, margin + 200, textY);
      
      textY += 15;
      doc.text(`Duration: ${frame.duration}s`, margin, textY);
      doc.text(`Movement: ${frame.cameraMovement}`, margin + 200, textY);

      if (options.includeTechnicalInfo) {
        textY += 20;
        doc.setFontSize(9);
        const cam = frame.sceneSnapshot.camera;
        doc.text(`Technical: f/${cam.aperture} | ${cam.focalLength}mm | ISO ${cam.iso}`, margin, textY);
      }

      if (options.includeNotes && frame.description) {
        textY += 25;
        doc.setFontSize(10);
        doc.text('Notes: ', margin, textY);
        textY += 12;
        doc.setFontSize(9);
        doc.text(frame.description, margin, textY, { maxWidth: usableWidth });
      }
    }
  }

  private async renderTechnicalLayout(
    doc: any,
    storyboard: Storyboard,
    options: ExportOptions,
    notify: ProgressCallback,
    dims: { width: number; height: number; margin: number; usableWidth: number; usableHeight: number }
  ) {
    // Technical layout with detailed lighting and equipment info
    await this.renderSingleLayout(doc, storyboard, { ...options, includeTechnicalInfo: true, includeNotes: true }, notify, dims);
  }

  private exportPDFBasic(
    storyboard: Storyboard,
    options: ExportOptions,
    notify: ProgressCallback
  ): Promise<ExportResult> {
    // Basic HTML-based PDF export as fallback
    notify({ stage: 'rendering', progress: 50, message: 'Generating basic PDF...' });
    
    // Create HTML content
    const html = this.generatePDFHTML(storyboard, options);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const filename = `${storyboard.name.replace(/\s+/g, '_')}_storyboard.html`;

    notify({ stage: 'finalizing', progress: 100, message: 'Complete!' });

    return Promise.resolve({
      success: true,
      blob,
      url,
      filename,
    });
  }

  private generatePDFHTML(storyboard: Storyboard, options: ExportOptions): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${storyboard.name} - Storyboard</title>
        <style>
          body { font-family: system-ui, sans-serif; margin: 40px; }
          h1 { text-align: center; }
          .frame { page-break-inside: avoid; margin: 20px 0; border: 1px solid #ddd; padding: 20px; }
          .frame img { max-width: 100%;, height: auto; }
          .info { margin-top: 10px; }
          @media print { .frame { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
        <h1>${storyboard.name}</h1>
        <p style="text-align:center">${storyboard.frames.length} frames • ${new Date().toLocaleDateString()}</p>
        ${storyboard.frames.map(frame => `
          <div class="frame">
            <img src="${frame.imageUrl}," alt="${frame.title}" />
            <div class="info">
              <strong>${frame.index + 1}. ${frame.title}</strong><br/>
              ${frame.shotType} • ${frame.cameraAngle} • ${frame.duration}s
              ${frame.description ? `<p>${frame.description}</p>` : ', '}
            </div>
          </div>
        `).join('')}
      </body>
      </html>
    `;
  }

  // =========================================================================
  // PNG Export
  // =========================================================================

  private async exportPNG(
    storyboard: Storyboard,
    options: ExportOptions,
    notify: ProgressCallback
  ): Promise<ExportResult> {
    notify({ stage: 'preparing', progress: 0, message: 'Preparing images...' });

    // Export as ZIP of individual PNGs
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (let i = 0; i < storyboard.frames.length; i++) {
      const frame = storyboard.frames[i];

      notify({
        stage: 'rendering',
        progress: Math.round((i / storyboard.frames.length) * 90),
        currentFrame: i + 1,
        totalFrames: storyboard.frames.length,
        message: `Processing frame ${i + 1}`,
      });

      try {
        const blob = await this.urlToBlob(frame.imageUrl);
        const filename = `frame_${String(i + 1).padStart(3, '0')}_${frame.title.replace(/\s+/g, '_')}.png`;
        zip.file(filename, blob);
      } catch (err) {
        log.warn(`Failed to add frame ${i + 1}:`, err);
      }
    }

    notify({ stage: 'encoding', progress: 92, message: 'Creating ZIP archive...' });
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const filename = `${storyboard.name.replace(/\s+/g, '_')}_frames.zip`;

    notify({ stage: 'finalizing', progress: 100, message: 'Complete!' });

    return { success: true, blob: zipBlob, url, filename };
  }

  // =========================================================================
  // Contact Sheet Export
  // =========================================================================

  private async exportContactSheet(
    storyboard: Storyboard,
    options: ExportOptions,
    notify: ProgressCallback
  ): Promise<ExportResult> {
    notify({ stage: 'preparing', progress: 0, message: 'Creating contact sheet...' });

    const cols = options.contactSheetColumns || 4;
    const rows = Math.ceil(storyboard.frames.length / cols);
    const thumbWidth = 400;
    const thumbHeight = Math.round(thumbWidth / (16 / 9));
    const padding = 20;
    const labelHeight = 40;

    const canvasWidth = cols * (thumbWidth + padding) + padding;
    const canvasHeight = rows * (thumbHeight + padding + labelHeight) + padding + 60; // Extra for title

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(storyboard.name, canvasWidth / 2, 40);

    // Frames
    for (let i = 0; i < storyboard.frames.length; i++) {
      const frame = storyboard.frames[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = padding + col * (thumbWidth + padding);
      const y = 60 + padding + row * (thumbHeight + padding + labelHeight);

      notify({
        stage: 'rendering',
        progress: Math.round((i / storyboard.frames.length) * 90),
        currentFrame: i + 1,
        totalFrames: storyboard.frames.length,
      });

      // Draw thumbnail
      try {
        const img = await this.loadImage(frame.thumbnailUrl || frame.imageUrl);
        ctx.drawImage(img, x, y, thumbWidth, thumbHeight);
      } catch {
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, thumbWidth, thumbHeight);
      }

      // Frame number badge
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x, y, 40, 24);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), x + 20, y + 17);

      // Label below
      ctx.fillStyle = '#fff';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`${frame.title}`, x, y + thumbHeight + 15);
      ctx.fillStyle = '#888';
      ctx.font = '10px system-ui';
      ctx.fillText(`${frame.shotType} • ${frame.duration}s`, x, y + thumbHeight + 30);
    }

    notify({ stage: 'encoding', progress: 95, message: 'Encoding image...' });

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });

    const url = URL.createObjectURL(blob);
    const filename = `${storyboard.name.replace(/\s+/g, '_')}_contact_sheet.png`;

    notify({ stage: 'finalizing', progress: 100, message: 'Complete!' });

    return { success: true, blob, url, filename };
  }

  // =========================================================================
  // Video Export
  // =========================================================================

  private async exportVideo(
    storyboard: Storyboard,
    options: ExportOptions,
    notify: ProgressCallback
  ): Promise<ExportResult> {
    notify({ stage: 'preparing', progress: 0, message: 'Preparing video export...' });

    const width = options.videoWidth || 1920;
    const height = options.videoHeight || 1080;
    const fps = options.videoFps || 24;
    const transitionType = options.transitionType || 'cut';
    const transitionDuration = options.transitionDuration || 0.5;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Check for MediaRecorder support
    if (!('MediaRecorder' in window)) {
      throw new Error('Video export is not supported in this browser');
    }

    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: this.getVideoBitrate(options.videoQuality || 'high'),
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    // Start recording
    recorder.start();

    // Render frames
    const totalDuration = storyboard.frames.reduce((sum, f) => sum + f.duration, 0);
    const totalFrameCount = Math.ceil(totalDuration * fps);
    let frameCount = 0;
    const accTime = 0;

    for (let i = 0; i < storyboard.frames.length; i++) {
      const frame = storyboard.frames[i];
      const prevFrame = i > 0 ? storyboard.frames[i - 1] : null;

      notify({
        stage: 'rendering',
        progress: Math.round((frameCount / totalFrameCount) * 80),
        currentFrame: i + 1,
        totalFrames: storyboard.frames.length,
        message: `Rendering frame ${i + 1}`,
      });

      // Load images
      const img = await this.loadImage(frame.imageUrl);
      const prevImg = prevFrame ? await this.loadImage(prevFrame.imageUrl).catch(() => null) : null;

      // Render frame duration worth of video frames
      const frameDurationFrames = Math.ceil(frame.duration * fps);
      const transitionFrames = Math.ceil(transitionDuration * fps);

      for (let f = 0; f < frameDurationFrames; f++) {
        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);

        // Draw frame (fit to canvas)
        const scale = Math.min(width / img.width, height / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const drawX = (width - drawWidth) / 2;
        const drawY = (height - drawHeight) / 2;

        // Handle transition at start of frame
        if (f < transitionFrames && prevImg && transitionType !== 'cut') {
          const t = f / transitionFrames;
          this.renderTransition(ctx, prevImg, img, t, transitionType, width, height);
        } else {
          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        }

        // Wait for next frame timing
        await new Promise((r) => setTimeout(r, 1000 / fps / 2));
        frameCount++;
      }
    }

    notify({ stage: 'encoding', progress: 85, message: 'Encoding video...' });

    // Stop recording
    recorder.stop();

    // Wait for recording to finish
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    notify({ stage: 'finalizing', progress: 95, message: 'Creating video file...' });

    const blob = new Blob(chunks, { type: 'video/webm' });
    const baseName = storyboard.name.replace(/\s+/g, '_');

    // Optionally optimize for streaming (fast-start with moov atom at beginning)
    if (options.optimizeForStreaming !== false) {
      notify({ stage: 'finalizing', progress: 96, message: 'Optimizing for streaming...' });
      
      try {
        const optimized = await this.optimizeVideoForStreaming(blob, `${baseName}_animatic.webm`);
        if (optimized) {
          notify({ stage: 'finalizing', progress: 100, message: 'Complete!' });
          return optimized;
        }
      } catch (error) {
        log.warn('Streaming optimization failed, using original:', error);
      }
    }

    const url = URL.createObjectURL(blob);
    const filename = `${baseName}_animatic.webm`;

    notify({ stage: 'finalizing', progress: 100, message: 'Complete!' });

    return { success: true, blob, url, filename };
  }

  /**
   * Optimize video for streaming via backend
   * Moves moov atom to file start for instant playback
   */
  private async optimizeVideoForStreaming(
    blob: Blob,
    filename: string
  ): Promise<ExportResult | null> {
    try {
      const formData = new FormData();
      formData.append('recordings', blob, filename);
      formData.append('timestamp', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
      formData.append('optimize', 'true');
      formData.append('metadata[]', JSON.stringify({
        filename,
        originalSize: blob.size,
        type: 'storyboard-animatic',
      }));

      const response = await fetch('/api/virtual-studio/recordings/bundle', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const zipBlob = await response.blob();
      const url = URL.createObjectURL(zipBlob);
      const optimizedFilename = filename.replace(/\.webm$/i, '_optimized.zip');

      log.info(`Animatic optimized for streaming: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`);

      return {
        success: true,
        blob: zipBlob,
        url,
        filename: optimizedFilename,
      };
    } catch (error) {
      log.error('Video streaming optimization failed:', error);
      return null;
    }
  }

  private renderTransition(
    ctx: CanvasRenderingContext2D,
    prevImg: HTMLImageElement,
    currentImg: HTMLImageElement,
    t: number,
    type: string,
    width: number,
    height: number
  ) {
    const scale1 = Math.min(width / prevImg.width, height / prevImg.height);
    const scale2 = Math.min(width / currentImg.width, height / currentImg.height);
    
    const drawWidth1 = prevImg.width * scale1;
    const drawHeight1 = prevImg.height * scale1;
    const drawX1 = (width - drawWidth1) / 2;
    const drawY1 = (height - drawHeight1) / 2;

    const drawWidth2 = currentImg.width * scale2;
    const drawHeight2 = currentImg.height * scale2;
    const drawX2 = (width - drawWidth2) / 2;
    const drawY2 = (height - drawHeight2) / 2;

    switch (type) {
      case 'fade':
        // Fade to black and back
        ctx.drawImage(prevImg, drawX1, drawY1, drawWidth1, drawHeight1);
        ctx.fillStyle = `rgba(0,0,0,${t < 0.5 ? t * 2 : (1 - t) * 2})`;
        ctx.fillRect(0, 0, width, height);
        if (t > 0.5) {
          ctx.globalAlpha = (t - 0.5) * 2;
          ctx.drawImage(currentImg, drawX2, drawY2, drawWidth2, drawHeight2);
          ctx.globalAlpha = 1;
        }
        break;

      case 'dissolve':
        // Cross-dissolve
        ctx.globalAlpha = 1 - t;
        ctx.drawImage(prevImg, drawX1, drawY1, drawWidth1, drawHeight1);
        ctx.globalAlpha = t;
        ctx.drawImage(currentImg, drawX2, drawY2, drawWidth2, drawHeight2);
        ctx.globalAlpha = 1;
        break;

      default:
        ctx.drawImage(currentImg, drawX2, drawY2, drawWidth2, drawHeight2);
    }
  }

  private getVideoBitrate(quality: string): number {
    switch (quality) {
      case 'low': return 2_000_000;
      case 'medium': return 5_000_000;
      case 'high': return 10_000_000;
      case 'max': return 20_000_000;
      default: return 10_000_000;
    }
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  private async loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin ='anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  private async loadImageAsBase64(url: string): Promise<string> {
    const img = await this.loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  private async urlToBlob(url: string): Promise<Blob> {
    // Handle data URLs
    if (url.startsWith('data:')) {
      const res = await fetch(url);
      return res.blob();
    }
    
    // Handle regular URLs
    const img = await this.loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
  }

  // =========================================================================
  // Download Helper
  // =========================================================================

  downloadResult(result: ExportResult): void {
    if (!result.success || !result.url || !result.filename) return;

    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const storyboardExportService = new StoryboardExportService();

export default storyboardExportService;
