/**
 * Shot Planner Visualizations
 * 
 * Helper functions to draw advanced visualization elements:
 * - Camera frustums with range labels
 * - Motion paths for camera movement
 * - Line of action between characters
 * - 180-degree safety line
 * - Measurement and guide lines
 * - Focus/depth of field visualization
 */

import * as PIXI from 'pixi.js';
import { Point2D, Camera2D, Actor2D, Shot2D } from './types';

// =============================================================================
// Colors & Styles
// =============================================================================

const COLORS = {
  frustum: 0x4CAF50,
  motionPath: 0x2196F3,
  lineOfAction: 0xFF9800,
  safetyLine: 0xFF5722,
  measurement: 0xFFD700,
  focus: 0xFF1493,
  dof: 0x9C27B0,
};

const OPACITIES = {
  frustum: 0.3,
  motionPath: 0.5,
  lineOfAction: 0.6,
  safetyLine: 0.4,
  measurement: 0.8,
  focus: 0.7,
  dof: 0.3,
};

// =============================================================================
// Frustum Visualization
// =============================================================================

export const drawCameraFrustum = (
  container: PIXI.Container,
  camera: Camera2D,
  pixelsPerMeter: number,
  opacity: number = OPACITIES.frustum
) => {
  const { position, rotation, frustum } = camera;
  const nearDist = frustum.nearDistance * pixelsPerMeter;
  const farDist = frustum.farDistance * pixelsPerMeter;
  const fovRad = (frustum.fov * Math.PI) / 180;

  // Near plane corners
  const nearHalfWidth = Math.tan(fovRad / 2) * nearDist;
  const rotRad = (rotation * Math.PI) / 180;
  const cosRot = Math.cos(rotRad);
  const sinRot = Math.sin(rotRad);

  // Calculate near corners in world space
  const nearLeft = {
    x: position.x + cosRot * nearDist - sinRot * nearHalfWidth,
    y: position.y + sinRot * nearDist + cosRot * nearHalfWidth,
  };
  const nearRight = {
    x: position.x + cosRot * nearDist + sinRot * nearHalfWidth,
    y: position.y + sinRot * nearDist - cosRot * nearHalfWidth,
  };

  // Far plane corners
  const farHalfWidth = Math.tan(fovRad / 2) * farDist;
  const farLeft = {
    x: position.x + cosRot * farDist - sinRot * farHalfWidth,
    y: position.y + sinRot * farDist + cosRot * farHalfWidth,
  };
  const farRight = {
    x: position.x + cosRot * farDist + sinRot * farHalfWidth,
    y: position.y + sinRot * farDist - cosRot * farHalfWidth,
  };

  const graphics = new PIXI.Graphics();
  graphics.lineStyle(2, COLORS.frustum, opacity);
  graphics.beginFill(COLORS.frustum, opacity * 0.1);

  // Draw frustum polygon
  graphics.moveTo(nearLeft.x, nearLeft.y);
  graphics.lineTo(nearRight.x, nearRight.y);
  graphics.lineTo(farRight.x, farRight.y);
  graphics.lineTo(farLeft.x, farLeft.y);
  graphics.closePath();

  // Draw centerline
  graphics.lineStyle(1, COLORS.frustum, opacity * 0.5);
  graphics.moveTo(position.x, position.y);
  graphics.lineTo(position.x + cosRot * farDist, position.y + sinRot * farDist);

  container.addChild(graphics);
};

// =============================================================================
// Motion Path Visualization
// =============================================================================

export const drawMotionPath = (
  container: PIXI.Container,
  path: Point2D[],
  opacity: number = OPACITIES.motionPath
) => {
  if (path.length < 2) return;

  const graphics = new PIXI.Graphics();
  graphics.lineStyle(3, COLORS.motionPath, opacity);

  graphics.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    graphics.lineTo(path[i].x, path[i].y);

    // Draw keyframe circle at each point
    graphics.beginFill(COLORS.motionPath, opacity);
    graphics.drawCircle(path[i].x, path[i].y, 5);
    graphics.endFill();
  }

  // Draw direction arrow at end
  if (path.length >= 2) {
    const lastPoint = path[path.length - 1];
    const prevPoint = path[path.length - 2];
    const angle = Math.atan2(lastPoint.y - prevPoint.y, lastPoint.x - prevPoint.x);

    graphics.beginFill(COLORS.motionPath, opacity);
    graphics.moveTo(lastPoint.x, lastPoint.y);
    graphics.lineTo(
      lastPoint.x - 8 * Math.cos(angle - Math.PI / 6),
      lastPoint.y - 8 * Math.sin(angle - Math.PI / 6)
    );
    graphics.lineTo(
      lastPoint.x - 8 * Math.cos(angle + Math.PI / 6),
      lastPoint.y - 8 * Math.sin(angle + Math.PI / 6)
    );
    graphics.closePath();
    graphics.endFill();
  }

  container.addChild(graphics);
};

// =============================================================================
// Line of Action
// =============================================================================

export const drawLineOfAction = (
  container: PIXI.Container,
  start: Point2D,
  end: Point2D,
  isSafe: boolean = true,
  opacity: number = OPACITIES.lineOfAction
) => {
  const graphics = new PIXI.Graphics();
  const color = isSafe ? COLORS.lineOfAction : COLORS.safetyLine;

  graphics.lineStyle(2, color, opacity);
  graphics.moveTo(start.x, start.y);
  graphics.lineTo(end.x, end.y);

  // Draw endpoints
  graphics.beginFill(color, opacity);
  graphics.drawCircle(start.x, start.y, 4);
  graphics.drawCircle(end.x, end.y, 4);
  graphics.endFill();

  // Draw safety indicator
  if (!isSafe) {
    graphics.lineStyle(1, COLORS.safetyLine, opacity);
    graphics.drawRect(
      Math.min(start.x, end.x) - 10,
      Math.min(start.y, end.y) - 10,
      Math.abs(end.x - start.x) + 20,
      Math.abs(end.y - start.y) + 20
    );
  }

  container.addChild(graphics);
};

// =============================================================================
// 180-Degree Safety Line
// =============================================================================

export const draw180DegreeLine = (
  container: PIXI.Container,
  camera: Camera2D,
  sceneWidth: number,
  sceneHeight: number,
  pixelsPerMeter: number,
  opacity: number = OPACITIES.safetyLine
) => {
  const rotRad = (camera.rotation * Math.PI) / 180;

  // Perpendicular line to camera direction
  const perpX = -Math.sin(rotRad);
  const perpY = Math.cos(rotRad);

  // Extend line across scene
  const extent = Math.max(sceneWidth, sceneHeight) * pixelsPerMeter;

  const start = {
    x: camera.position.x - perpX * extent,
    y: camera.position.y - perpY * extent,
  };
  const end = {
    x: camera.position.x + perpX * extent,
    y: camera.position.y + perpY * extent,
  };

  const graphics = new PIXI.Graphics();
  graphics.lineStyle(2, COLORS.safetyLine, opacity);
  graphics.moveTo(start.x, start.y);
  graphics.lineTo(end.x, end.y);

  container.addChild(graphics);
};

// =============================================================================
// Depth of Field Visualization
// =============================================================================

export const drawDepthOfField = (
  container: PIXI.Container,
  camera: Camera2D,
  focusDistance: number,
  dofRange: number,
  pixelsPerMeter: number,
  opacity: number = OPACITIES.dof
) => {
  const rotRad = (camera.rotation * Math.PI) / 180;
  const dirX = Math.cos(rotRad);
  const dirY = Math.sin(rotRad);

  // Focus plane
  const focusDist = focusDistance * pixelsPerMeter;
  const focusStart = {
    x: camera.position.x + dirX * focusDist - dirY * 100,
    y: camera.position.y + dirY * focusDist + dirX * 100,
  };
  const focusEnd = {
    x: camera.position.x + dirX * focusDist + dirY * 100,
    y: camera.position.y + dirY * focusDist - dirX * 100,
  };

  const graphics = new PIXI.Graphics();

  // DoF zones (blurred areas)
  const nearDist = (focusDistance - dofRange) * pixelsPerMeter;
  const farDist = (focusDistance + dofRange) * pixelsPerMeter;

  const nearStart = {
    x: camera.position.x + dirX * nearDist - dirY * 100,
    y: camera.position.y + dirY * nearDist + dirX * 100,
  };
  const farStart = {
    x: camera.position.x + dirX * farDist - dirY * 100,
    y: camera.position.y + dirY * farDist + dirX * 100,
  };

  // Draw DoF zone
  graphics.lineStyle(1, COLORS.dof, opacity * 0.5);
  graphics.moveTo(nearStart.x, nearStart.y);
  graphics.lineTo(nearStart.x + 200, nearStart.y);

  graphics.moveTo(farStart.x, farStart.y);
  graphics.lineTo(farStart.x + 200, farStart.y);

  // Draw focus plane
  graphics.lineStyle(2, COLORS.focus, opacity);
  graphics.moveTo(focusStart.x, focusStart.y);
  graphics.lineTo(focusEnd.x, focusEnd.y);

  container.addChild(graphics);
};

// =============================================================================
// Measurement Lines
// =============================================================================

export const drawMeasurementLine = (
  container: PIXI.Container,
  start: Point2D,
  end: Point2D,
  label?: string,
  opacity: number = OPACITIES.measurement
) => {
  const graphics = new PIXI.Graphics();

  // Line
  graphics.lineStyle(2, COLORS.measurement, opacity);
  graphics.moveTo(start.x, start.y);
  graphics.lineTo(end.x, end.y);

  // Endpoints
  graphics.beginFill(COLORS.measurement, opacity);
  graphics.drawCircle(start.x, start.y, 3);
  graphics.drawCircle(end.x, end.y, 3);
  graphics.endFill();

  // Distance label
  if (label) {
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };

    const text = new PIXI.Text(label, {
      fontSize: 12,
      fill: COLORS.measurement,
      padding: 2,
    });
    text.position.set(midpoint.x, midpoint.y - 15);
    container.addChild(text);
  }

  container.addChild(graphics);
};

// =============================================================================
// Actor Movement Path Visualization
// =============================================================================

/**
 * Draw actor movement paths with direction arrows
 */
export const drawActorMovementPath = (
  container: PIXI.Container,
  actor: Actor2D,
  opacity: number = OPACITIES.motionPath
) => {
  if (!actor.movementPath || actor.movementPath.length < 2) return;
  
  const graphics = new PIXI.Graphics();
  const color = parseInt(actor.color.replace('#', ''), 16);
  
  // Draw path line
  graphics.lineStyle(3, color, opacity);
  graphics.moveTo(actor.position.x, actor.position.y);
  
  actor.movementPath.forEach((point, index) => {
    graphics.lineTo(point.x, point.y);
    
    // Draw keyframe markers
    graphics.lineStyle(0);
    graphics.beginFill(color, opacity);
    graphics.drawCircle(point.x, point.y, 6);
    graphics.endFill();
    graphics.lineStyle(3, color, opacity);
    
    // Draw direction arrow
    if (index > 0) {
      const prev = actor.movementPath![index - 1];
      const dx = point.x - prev.x;
      const dy = point.y - prev.y;
      const angle = Math.atan2(dy, dx);
      
      const arrowSize = 12;
      const arrowX = point.x;
      const arrowY = point.y;
      
      graphics.moveTo(arrowX, arrowY);
      graphics.lineTo(
        arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
        arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      graphics.moveTo(arrowX, arrowY);
      graphics.lineTo(
        arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
        arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
      );
    }
  });
  
  // Add label
  const text = new PIXI.Text(`${actor.name} Path`, {
    fontFamily: 'Inter, system-ui',
    fontSize: 11,
    fill: color,
    align: 'center',
  });
  const lastPoint = actor.movementPath[actor.movementPath.length - 1];
  text.position.set(lastPoint.x, lastPoint.y - 20);
  text.anchor.set(0.5, 0.5);
  
  container.addChild(graphics);
  container.addChild(text);
};

// =============================================================================
// Export Functions
// =============================================================================

export default {
  drawCameraFrustum,
  drawMotionPath,
  drawLineOfAction,
  draw180DegreeLine,
  drawDepthOfField,
  drawMeasurementLine,
  drawActorMovementPath,
};
