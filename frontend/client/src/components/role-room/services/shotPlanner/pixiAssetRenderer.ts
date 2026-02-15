/**
 * Pixi Asset Renderer
 * 
 * Generates Pixi graphics for 2D assets and creates preview thumbnails.
 * Used by the asset panel to display asset previews.
 */

import * as PIXI from 'pixi.js';
import { Asset2DDefinition } from './types';

/**
 * Create a Pixi graphic for a furniture asset
 */
export const createFurnitureGraphic = (asset: Asset2DDefinition): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  const { defaultSize, defaultColor } = asset;
  
  const color = parseInt(defaultColor.replace('#', ''), 16);
  graphics.fill({ color, alpha: 0.8 });
  
  // Draw as rounded rectangle
  graphics.roundRect(0, 0, defaultSize.width, defaultSize.height, 4);
  
  // Add border
  graphics.stroke({ color: 0x333333, width: 2 });
  
  return graphics;
};

/**
 * Create a Pixi graphic for a prop asset
 */
export const createPropGraphic = (asset: Asset2DDefinition): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  const { defaultSize, defaultColor } = asset;
  
  const color = parseInt(defaultColor.replace('#', ''), 16);
  
  // Draw circular props
  graphics.fill({ color, alpha: 0.7 });
  graphics.circle(defaultSize.width / 2, defaultSize.height / 2, defaultSize.width / 2);
  graphics.stroke({ color: 0x555555, width: 1.5 });
  
  return graphics;
};

/**
 * Create a Pixi graphic for a character/actor asset
 */
export const createActorGraphic = (asset: Asset2DDefinition): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  const { defaultSize, defaultColor } = asset;
  
  const color = parseInt(defaultColor.replace('#', ''), 16);
  
  // Draw simple stick figure
  const centerX = defaultSize.width / 2;
  const centerY = defaultSize.height / 2;
  
  // Head
  graphics.fill({ color, alpha: 0.8 });
  graphics.circle(centerX, centerY - 15, 8);
  
  // Body
  graphics.fill({ color, alpha: 0.8 });
  graphics.rect(centerX - 4, centerY - 5, 8, 15);
  
  // Arms
  graphics.stroke({ color, width: 2 });
  graphics.moveTo(centerX - 4, centerY + 2);
  graphics.lineTo(centerX - 15, centerY + 2);
  graphics.moveTo(centerX + 4, centerY + 2);
  graphics.lineTo(centerX + 15, centerY + 2);
  
  // Legs
  graphics.moveTo(centerX - 2, centerY + 10);
  graphics.lineTo(centerX - 8, centerY + 20);
  graphics.moveTo(centerX + 2, centerY + 10);
  graphics.lineTo(centerX + 8, centerY + 20);
  
  return graphics;
};

/**
 * Create a Pixi graphic for a vehicle asset
 */
export const createVehicleGraphic = (asset: Asset2DDefinition): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  const { defaultSize, defaultColor } = asset;
  
  const color = parseInt(defaultColor.replace('#', ''), 16);
  
  // Main body
  graphics.fill({ color, alpha: 0.8 });
  graphics.rect(0, defaultSize.height / 2 - 10, defaultSize.width, 20);
  
  // Top cabin
  graphics.fill({ color, alpha: 0.9 });
  graphics.rect(defaultSize.width * 0.2, defaultSize.height / 2 - 20, defaultSize.width * 0.6, 10);
  
  // Wheels
  graphics.fill({ color: 0x111111, alpha: 0.9 });
  graphics.circle(defaultSize.width * 0.2, defaultSize.height / 2 + 15, 5);
  graphics.circle(defaultSize.width * 0.8, defaultSize.height / 2 + 15, 5);
  
  return graphics;
};

/**
 * Create a Pixi graphic for a camera asset (top-down view)
 */
export const createCameraGraphic = (asset: Asset2DDefinition): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  const { defaultSize, defaultColor } = asset;
  
  const color = parseInt(defaultColor.replace('#', ''), 16);
  
  // Camera body (rectangle)
  graphics.fill({ color, alpha: 0.8 });
  graphics.rect(defaultSize.width * 0.2, defaultSize.height * 0.3, defaultSize.width * 0.6, defaultSize.height * 0.4);
  
  // Lens (circle)
  graphics.fill({ color: 0x333333, alpha: 0.9 });
  graphics.circle(defaultSize.width / 2, defaultSize.height / 2, defaultSize.width * 0.12);
  
  // Viewfinder indicator
  graphics.stroke({ color: 0xFFD700, width: 1 });
  graphics.moveTo(defaultSize.width * 0.1, defaultSize.height * 0.1);
  graphics.lineTo(defaultSize.width * 0.9, defaultSize.height * 0.1);
  graphics.lineTo(defaultSize.width * 0.9, defaultSize.height * 0.9);
  graphics.lineTo(defaultSize.width * 0.1, defaultSize.height * 0.9);
  graphics.lineTo(defaultSize.width * 0.1, defaultSize.height * 0.1);
  
  return graphics;
};

/**
 * Create a Pixi graphic for an architectural element (door/window/wall)
 */
export const createArchitecturalGraphic = (asset: Asset2DDefinition): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  const { defaultSize, defaultColor } = asset;
  
  const color = parseInt(defaultColor.replace('#', ''), 16);
  
  // Main element
  graphics.fill({ color, alpha: 0.6 });
  graphics.rect(0, 0, defaultSize.width, defaultSize.height);
  
  // Border
  graphics.stroke({ color: 0x000000, width: 2 });
  
  // Details based on asset name
  if (asset.name.toLowerCase().includes('door')) {
    // Door knob
    graphics.fill({ color: 0xFFD700, alpha: 0.8 });
    graphics.circle(defaultSize.width * 0.8, defaultSize.height / 2, 3);
  } else if (asset.name.toLowerCase().includes('window')) {
    // Window panes
    graphics.stroke({ color: 0x000000, width: 1 });
    graphics.moveTo(defaultSize.width / 2, 0);
    graphics.lineTo(defaultSize.width / 2, defaultSize.height);
    graphics.moveTo(0, defaultSize.height / 2);
    graphics.lineTo(defaultSize.width, defaultSize.height / 2);
  }
  
  return graphics;
};

/**
 * Create a Pixi graphic for a nature asset (tree/bush)
 */
export const createNatureGraphic = (asset: Asset2DDefinition): PIXI.Graphics => {
  const graphics = new PIXI.Graphics();
  const { defaultSize, defaultColor } = asset;
  
  const color = parseInt(defaultColor.replace('#', ''), 16);
  const centerX = defaultSize.width / 2;
  const centerY = defaultSize.height / 2;
  
  if (asset.name.toLowerCase().includes('tree')) {
    // Trunk
    graphics.fill({ color: 0x8B4513, alpha: 0.8 });
    graphics.rect(centerX - 4, centerY + 5, 8, 12);
    
    // Foliage (circle)
    graphics.fill({ color, alpha: 0.8 });
    graphics.circle(centerX, centerY - 5, 12);
  } else {
    // Bush - just a rounded shape
    graphics.fill({ color, alpha: 0.8 });
    graphics.roundRect(centerX - 12, centerY - 10, 24, 20, 8);
  }
  
  return graphics;
};

/**
 * Create a Pixi graphic based on asset type
 */
export const createAssetGraphic = (asset: Asset2DDefinition): PIXI.Container => {
  switch (asset.type) {
    case 'furniture':
      return createFurnitureGraphic(asset);
    case 'prop':
      return createPropGraphic(asset);
    case 'actor':
      return createActorGraphic(asset);
    case 'vehicle':
      return createVehicleGraphic(asset);
    case 'camera':
      return createCameraGraphic(asset);
    case 'nature':
      return createNatureGraphic(asset);
    default:
      return createArchitecturalGraphic(asset);
  }
};

/**
 * Generate a canvas preview thumbnail for an asset
 */
export const generateAssetThumbnail = (asset: Asset2DDefinition, size: number = 80): string => {
  try {
    // Create a small canvas
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return '';
    
    // Fill background
    ctx.fillStyle = '#1A2332';
    ctx.fillRect(0, 0, size, size);
    
    // Draw asset
    const color = asset.defaultColor;
    ctx.fillStyle = color;
    
    const margin = size * 0.1;
    const assetWidth = size - margin * 2;
    const assetHeight = size - margin * 2;
    
    switch (asset.type) {
      case 'furniture':
        ctx.fillRect(margin, margin, assetWidth, assetHeight);
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.strokeRect(margin, margin, assetWidth, assetHeight);
        break;
        
      case 'actor':
        // Draw simple head
        ctx.beginPath();
        ctx.arc(size / 2, size / 3, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw body line
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(size / 2, size / 3 + 6);
        ctx.lineTo(size / 2, size * 0.6);
        ctx.stroke();
        
        // Draw arms
        ctx.beginPath();
        ctx.moveTo(size / 2 - 8, size * 0.45);
        ctx.lineTo(size / 2 + 8, size * 0.45);
        ctx.stroke();
        break;
        
      case 'prop':
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, assetWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'camera':
        ctx.fillRect(margin + 10, margin + 10, assetWidth - 20, assetHeight - 20);
        ctx.fillStyle = '#333333';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'vehicle':
        // Car body
        ctx.fillRect(margin, size / 2 - 5, assetWidth, 10);
        // Cabin
        ctx.fillRect(margin + 10, size / 2 - 12, assetWidth - 20, 7);
        // Wheels
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(margin + 8, size / 2 + 8, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(margin + assetWidth - 8, size / 2 + 8, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'nature':
        if (asset.name.toLowerCase().includes('tree')) {
          // Trunk
          ctx.fillStyle = '#8B4513';
          ctx.fillRect(size / 2 - 3, size * 0.6, 6, 12);
          // Foliage
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(size / 2, size / 3, 10, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Bush
          ctx.fillRect(margin, margin + 5, assetWidth, assetHeight - 10);
        }
        break;
        
      default:
        ctx.fillRect(margin, margin, assetWidth, assetHeight);
    }
    
    return canvas.toDataURL();
  } catch (error) {
    console.error('Error generating asset thumbnail:', error);
    return '';
  }
};

/**
 * Batch generate thumbnails for multiple assets
 */
export const generateAssetThumbnails = (assets: Asset2DDefinition[], size: number = 80): Record<string, string> => {
  const thumbnails: Record<string, string> = {};
  
  for (const asset of assets) {
    thumbnails[asset.id] = generateAssetThumbnail(asset, size);
  }
  
  return thumbnails;
};
