/**
 * Framing Guide Component
 * Shows rule of thirds, golden ratio, and other composition guides
 */

import React, { useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import * as PIXI from 'pixi.js';
import { FramingGuide } from './types';

interface FramingGuideRendererProps {
  canvas: HTMLCanvasElement | null;
  width: number;
  height: number;
  guides: FramingGuide[];
}

export const FramingGuideRenderer: React.FC<FramingGuideRendererProps> = ({
  canvas,
  width,
  height,
  guides,
}) => {
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const containerRef = useRef<PIXI.Container | null>(null);

  useEffect(() => {
    if (!canvas) return;

    // Create PIXI app
    if (!pixiAppRef.current) {
      pixiAppRef.current = new PIXI.Application({
        width,
        height,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio,
      });

      const overlay = document.createElement('canvas');
      overlay.width = width;
      overlay.height = height;
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '10';

      canvas.parentElement?.appendChild(overlay);

      containerRef.current = new PIXI.Container();
      pixiAppRef.current.stage.addChild(containerRef.current);
    }

    const container = containerRef.current!;
    container.removeChildren();

    // Draw guides
    guides.forEach(guide => {
      if (!guide.visible) return;

      const graphics = new PIXI.Graphics();
      graphics.lineStyle(1, 0x4FC3F7, guide.opacity);

      switch (guide.type) {
        case 'rule-of-thirds':
          // Vertical lines
          const vSpacing = width / 3;
          for (let i = 1; i < 3; i++) {
            graphics.moveTo(vSpacing * i, 0);
            graphics.lineTo(vSpacing * i, height);
          }
          // Horizontal lines
          const hSpacing = height / 3;
          for (let i = 1; i < 3; i++) {
            graphics.moveTo(0, hSpacing * i);
            graphics.lineTo(width, hSpacing * i);
          }
          break;

        case 'golden-ratio':
          // Golden ratio spiral approximation
          const phi = 1.618;
          let x = 0;
          let y = 0;
          let w = width;
          let h = height;

          for (let i = 0; i < 4; i++) {
            const fw = w / phi;
            const fh = h / phi;

            if (i % 2 === 0) {
              graphics.moveTo(x + fw, y);
              graphics.lineTo(x + fw, y + h);
              x += fw;
              w -= fw;
            } else {
              graphics.moveTo(x, y + fh);
              graphics.lineTo(x + w, y + fh);
              y += fh;
              h -= fh;
            }
          }
          break;

        case 'center':
          // Center crosshairs
          graphics.lineStyle(1, 0xFFD54F, guide.opacity);
          const centerX = width / 2;
          const centerY = height / 2;
          const crossSize = 50;

          graphics.moveTo(centerX - crossSize, centerY);
          graphics.lineTo(centerX + crossSize, centerY);
          graphics.moveTo(centerX, centerY - crossSize);
          graphics.lineTo(centerX, centerY + crossSize);

          // Center circle
          graphics.lineStyle(1, 0xFFD54F, guide.opacity * 0.5);
          graphics.drawCircle(centerX, centerY, 80);
          break;

        case 'diagonal':
          // Diagonal lines
          graphics.lineStyle(1, 0xBA68C8, guide.opacity);
          graphics.moveTo(0, 0);
          graphics.lineTo(width, height);
          graphics.moveTo(width, 0);
          graphics.lineTo(0, height);
          break;
      }

      container.addChild(graphics);
    });

    // Render
    pixiAppRef.current.render();
  }, [canvas, width, height, guides]);

  return null;
};

export default FramingGuideRenderer;
