import * as PIXI from 'pixi.js';
import { Asset2DDefinition } from './types';

const THUMB_CACHE = new Map<string, string>();
let pixiInitialized = false;

export async function generateThumbnail(asset: Asset2DDefinition, size = 128): Promise<string> {
  if (THUMB_CACHE.has(asset.id)) return THUMB_CACHE.get(asset.id)!;

  // Initialize PIXI once
  if (!pixiInitialized) {
    try {
      await PIXI.Assets.init();
      pixiInitialized = true;
    } catch (e) {
      // Already initialized or not needed
    }
  }

  // Create headless PIXI application
  const app = new PIXI.Application();
  await app.init({
    width: size,
    height: size,
    backgroundAlpha: 0,
    resolution: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    antialias: true,
  });

  const g = new PIXI.Graphics();

  // Fit asset into thumbnail while preserving aspect
  const assetW = Math.max(1, asset.defaultSize.width);
  const assetH = Math.max(1, asset.defaultSize.height);
  const maxPad = size * 0.7;
  const aspect = assetW / assetH;
  let drawW = maxPad;
  let drawH = drawW / aspect;
  if (drawH > maxPad) {
    drawH = maxPad;
    drawW = drawH * aspect;
  }

  const x = (size - drawW) / 2;
  const y = (size - drawH) / 2;

  const color = asset.defaultColor || '#999999';
  const colorNum = parseInt(color.replace('#', ''), 16);
  
  if (asset.type === 'actor') {
    const radius = Math.min(drawW, drawH) / 2;
    g.circle(size / 2, size / 2, radius);
    g.fill({ color: colorNum });
  } else {
    const radius = Math.min(8, Math.min(drawW, drawH) * 0.08);
    g.roundRect(x, y, drawW, drawH, radius);
    g.fill({ color: colorNum });
  }

  app.stage.addChild(g);

  // Extract as base64 PNG
  let base64 = '';
  try {
    base64 = app.renderer.extract.base64(app.stage);
  } catch (e) {
    // Fallback: try canvas extract
    try {
      const canvas = app.renderer.extract.canvas(app.stage);
      base64 = canvas.toDataURL();
    } catch (err) {
      base64 = '';
    }
  }

  app.destroy(true, { children: true, texture: true, baseTexture: true });

  if (base64) THUMB_CACHE.set(asset.id, base64);
  return base64;
}

export function getCachedThumbnail(assetId: string): string | undefined {
  return THUMB_CACHE.get(assetId);
}

export async function preGenerateAllThumbnails(assets: Asset2DDefinition[], size = 128): Promise<void> {
  console.log(`[Pixi Thumbnailer] Generating ${assets.length} thumbnails...`);
  const batchSize = 10;
  const batches: Asset2DDefinition[][] = [];
  
  for (let i = 0; i < assets.length; i += batchSize) {
    batches.push(assets.slice(i, i + batchSize));
  }
  
  let completed = 0;
  for (const batch of batches) {
    await Promise.all(
      batch.map(asset => 
        generateThumbnail(asset, size)
          .then(() => { completed++; })
          .catch(() => {
            console.warn(`[Pixi Thumbnailer] Failed to generate thumbnail for ${asset.id}`);
          })
      )
    );
  }
  
  console.log(`[Pixi Thumbnailer] Generated ${completed}/${assets.length} thumbnails`);
}
