// @ts-nocheck
import { describe, expect, it } from 'vitest';
import {
  POSE_LIBRARY,
  getPosesByCategory,
  searchPoses,
  buildStrokesFromPose,
} from '../poseLibrary';

describe('Sprint A.7 — pose library data', () => {
  it('biblioteket har minst 10 poser', () => {
    expect(POSE_LIBRARY.length).toBeGreaterThanOrEqual(10);
  });

  it('alle poser har unik id', () => {
    const ids = POSE_LIBRARY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('alle poser har 8 limbs (standard stick-figure-anatomi)', () => {
    POSE_LIBRARY.forEach((pose) => {
      expect(pose.limbs.length).toBe(8);
    });
  });

  it('alle limbs har minst 2 punkter (eller hode med 12+ for sirkel)', () => {
    POSE_LIBRARY.forEach((pose) => {
      pose.limbs.forEach((limb) => {
        if (limb.name === 'head') {
          expect(limb.points.length).toBeGreaterThanOrEqual(12);
        } else {
          expect(limb.points.length).toBeGreaterThanOrEqual(2);
        }
      });
    });
  });

  it('alle punkter er normalisert til 0..1', () => {
    POSE_LIBRARY.forEach((pose) => {
      pose.limbs.forEach((limb) => {
        limb.points.forEach((p) => {
          expect(p.x).toBeGreaterThanOrEqual(-0.05);
          expect(p.x).toBeLessThanOrEqual(1.05);
          expect(p.y).toBeGreaterThanOrEqual(-0.05);
          expect(p.y).toBeLessThanOrEqual(1.05);
        });
      });
    });
  });
});

describe('Sprint A.7 — pose filter / søk', () => {
  it('getPosesByCategory("action") returnerer kun action-poser', () => {
    const actions = getPosesByCategory('action');
    expect(actions.length).toBeGreaterThan(0);
    actions.forEach((pose) => {
      expect(pose.category).toBe('action');
    });
  });

  it('searchPoses("løp") finner running-posen', () => {
    const result = searchPoses('løp');
    expect(result.some((p) => p.id === 'running')).toBe(true);
  });

  it('searchPoses("walk") finner walking via tag', () => {
    const result = searchPoses('walk');
    expect(result.some((p) => p.id === 'walking')).toBe(true);
  });

  it('searchPoses("") returnerer hele biblioteket', () => {
    const result = searchPoses('');
    expect(result.length).toBe(POSE_LIBRARY.length);
  });

  it('searchPoses med ukjent ord returnerer tom liste', () => {
    const result = searchPoses('xyzzy-12345');
    expect(result).toEqual([]);
  });
});

describe('Sprint A.7 — buildStrokesFromPose', () => {
  const standing = POSE_LIBRARY[0];

  it('genererer én stroke per limb (8 totalt)', () => {
    const strokes = buildStrokesFromPose(standing, { canvasWidth: 800, canvasHeight: 600 });
    expect(strokes).toHaveLength(8);
  });

  it('strokes har gyldige punkter i canvas-koordinater', () => {
    const strokes = buildStrokesFromPose(standing, { canvasWidth: 800, canvasHeight: 600 });
    strokes.forEach((stroke) => {
      stroke.points.forEach((point) => {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(800);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(600);
      });
    });
  });

  it('scale=1 fyller hele canvas', () => {
    const smallScale = buildStrokesFromPose(standing, {
      canvasWidth: 1000, canvasHeight: 1000, scale: 0.2,
    });
    const fullScale = buildStrokesFromPose(standing, {
      canvasWidth: 1000, canvasHeight: 1000, scale: 1.0,
    });
    // Større scale → mer spread (foot/head lengre fra senter).
    const smallBox = boundingBoxOf(smallScale);
    const fullBox = boundingBoxOf(fullScale);
    expect(fullBox.width).toBeGreaterThan(smallBox.width);
  });

  it('flipHorizontal speilvender x-koordinater', () => {
    const normal = buildStrokesFromPose(standing, {
      canvasWidth: 1000, canvasHeight: 1000, scale: 0.5,
    });
    const flipped = buildStrokesFromPose(standing, {
      canvasWidth: 1000, canvasHeight: 1000, scale: 0.5, flipHorizontal: true,
    });
    // Punkt 0 i normal-strokes vs flipped-strokes skal være speilvendt om x=500
    const normalLimb = normal.find((s) => s.id.includes('left-arm'));
    const flippedLimb = flipped.find((s) => s.id.includes('left-arm'));
    expect(normalLimb).toBeDefined();
    expect(flippedLimb).toBeDefined();
    const normalX = normalLimb!.points[0].x;
    const flippedX = flippedLimb!.points[0].x;
    expect(Math.abs((normalX + flippedX) / 2 - 500)).toBeLessThan(10);
  });

  it('default color er nøytral grå', () => {
    const strokes = buildStrokesFromPose(standing, { canvasWidth: 100, canvasHeight: 100 });
    strokes.forEach((stroke) => {
      expect(stroke.color).toBe('#9ca3af');
    });
  });

  it('custom color overstyrer', () => {
    const strokes = buildStrokesFromPose(standing, {
      canvasWidth: 100, canvasHeight: 100, color: '#ff0000',
    });
    strokes.forEach((stroke) => {
      expect(stroke.color).toBe('#ff0000');
    });
  });

  it('strokes har low opacity for at artisten kan tegne over', () => {
    const strokes = buildStrokesFromPose(standing, { canvasWidth: 100, canvasHeight: 100 });
    strokes.forEach((stroke) => {
      expect(stroke.opacity).toBeLessThan(1);
      expect(stroke.opacity).toBeGreaterThan(0);
    });
  });
});

function boundingBoxOf(strokes: Array<{ points: Array<{ x: number; y: number }> }>): { width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of strokes) {
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return { width: maxX - minX, height: maxY - minY };
}
