// @ts-nocheck
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { planClippingPasses, renderLayersWithClipping } from '../clippingMaskRenderer';

// jsdom mangler canvas-2D; vi stubber bare det vi trenger for å verifisere
// at riktig compositing-rekkefølge brukes. Vi inspecter ikke pixel-output.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function () {
    const ops: string[] = [];
    const ctx: any = {
      ops,
      save() { ops.push('save'); },
      restore() { ops.push('restore'); },
      drawImage() { ops.push('drawImage'); },
      set globalCompositeOperation(v: string) { ops.push(`gco:${v}`); },
      set globalAlpha(v: number) { ops.push(`alpha:${v}`); },
    };
    return ctx;
  } as any;
});

function makeLayer(id: string, opts: Partial<any> = {}): any {
  return {
    id,
    name: id,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    strokes: [],
    clippingMask: false,
    ...opts,
  };
}

describe('Sprint A.7 — Clipping mask rendering', () => {
  describe('planClippingPasses', () => {
    it('lag uten mask ender som preMaskLayers, ingen grupper', () => {
      const layers = [makeLayer('a'), makeLayer('b'), makeLayer('c')];
      const { preMaskLayers, groups } = planClippingPasses(layers);
      expect(preMaskLayers.map((l) => l.id)).toEqual(['a', 'b', 'c']);
      expect(groups).toHaveLength(0);
    });

    it('mask med to lag over = én gruppe med 2 clipped', () => {
      const layers = [
        makeLayer('base'),
        makeLayer('mask', { clippingMask: true }),
        makeLayer('paint1'),
        makeLayer('paint2'),
      ];
      const { preMaskLayers, groups } = planClippingPasses(layers);
      expect(preMaskLayers.map((l) => l.id)).toEqual(['base']);
      expect(groups).toHaveLength(1);
      expect(groups[0].maskLayer.id).toBe('mask');
      expect(groups[0].clippedLayers.map((l) => l.id)).toEqual(['paint1', 'paint2']);
    });

    it('to masks etter hverandre = to grupper', () => {
      const layers = [
        makeLayer('maskA', { clippingMask: true }),
        makeLayer('paintA'),
        makeLayer('maskB', { clippingMask: true }),
        makeLayer('paintB'),
      ];
      const { preMaskLayers, groups } = planClippingPasses(layers);
      expect(preMaskLayers).toHaveLength(0);
      expect(groups).toHaveLength(2);
      expect(groups[0].maskLayer.id).toBe('maskA');
      expect(groups[0].clippedLayers.map((l) => l.id)).toEqual(['paintA']);
      expect(groups[1].maskLayer.id).toBe('maskB');
      expect(groups[1].clippedLayers.map((l) => l.id)).toEqual(['paintB']);
    });

    it('tomme mask-grupper (mask uten clipped over) er gyldige', () => {
      const layers = [
        makeLayer('base'),
        makeLayer('mask', { clippingMask: true }),
      ];
      const { preMaskLayers, groups } = planClippingPasses(layers);
      expect(preMaskLayers.map((l) => l.id)).toEqual(['base']);
      expect(groups).toHaveLength(1);
      expect(groups[0].clippedLayers).toHaveLength(0);
    });
  });

  describe('renderLayersWithClipping', () => {
    it('preMask-lag tegnes direkte til target (ingen offscreen drawImage)', () => {
      const target = document.createElement('canvas');
      const ctx = target.getContext('2d') as any;
      const renderLayerStrokes = vi.fn();

      renderLayersWithClipping({
        ctx,
        width: 100,
        height: 100,
        layers: [makeLayer('a'), makeLayer('b')],
        renderLayerStrokes,
      });

      expect(renderLayerStrokes).toHaveBeenCalledTimes(2);
      // Ingen drawImage = ingen offscreen-komposit
      expect(ctx.ops).not.toContain('drawImage');
    });

    it('mask-gruppe trigger source-atop og drawImage til target', () => {
      const target = document.createElement('canvas');
      const ctx = target.getContext('2d') as any;
      const renderLayerStrokes = vi.fn();

      renderLayersWithClipping({
        ctx,
        width: 100,
        height: 100,
        layers: [
          makeLayer('mask', { clippingMask: true }),
          makeLayer('shade'),
        ],
        renderLayerStrokes,
      });

      // Mask + shade tegnes til offscreen — vi kaller renderLayerStrokes 2 ganger.
      expect(renderLayerStrokes).toHaveBeenCalledTimes(2);
      // Etter offscreen-render skal target få drawImage.
      expect(ctx.ops).toContain('drawImage');
    });

    it('source-atop brukes på shade-laget inni gruppen', () => {
      const target = document.createElement('canvas');
      const ctx = target.getContext('2d') as any;

      // Vi inspecter offscreen-ctx-en gjennom å spy på getContext-resultatet.
      // Capturer ops for ALLE oppretede canvas-contexts.
      const allOps: string[] = [];
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function () {
        const c: any = {
          save() { allOps.push('save'); },
          restore() { allOps.push('restore'); },
          drawImage() { allOps.push('drawImage'); },
          set globalCompositeOperation(v: string) { allOps.push(`gco:${v}`); },
          set globalAlpha(v: number) { allOps.push(`alpha:${v}`); },
        };
        return c;
      } as any;

      const renderLayerStrokes = vi.fn();
      renderLayersWithClipping({
        ctx: target.getContext('2d') as any,
        width: 100,
        height: 100,
        layers: [
          makeLayer('mask', { clippingMask: true }),
          makeLayer('shade'),
        ],
        renderLayerStrokes,
      });

      HTMLCanvasElement.prototype.getContext = origGetContext;

      // Vi forventer at offscreen-ctx settes til source-atop én gang
      // (for shade-laget).
      expect(allOps).toContain('gco:source-atop');
    });

    it('respectVisibility=true (default) hopper over usynlige lag', () => {
      const ctx = (document.createElement('canvas').getContext('2d')) as any;
      const renderLayerStrokes = vi.fn();
      renderLayersWithClipping({
        ctx,
        width: 100,
        height: 100,
        layers: [
          makeLayer('visible'),
          makeLayer('hidden', { visible: false }),
        ],
        renderLayerStrokes,
      });
      expect(renderLayerStrokes).toHaveBeenCalledTimes(1);
    });

    it('respectVisibility=false rendrer alle lag', () => {
      const ctx = (document.createElement('canvas').getContext('2d')) as any;
      const renderLayerStrokes = vi.fn();
      renderLayersWithClipping({
        ctx,
        width: 100,
        height: 100,
        respectVisibility: false,
        layers: [
          makeLayer('a'),
          makeLayer('b', { visible: false }),
        ],
        renderLayerStrokes,
      });
      expect(renderLayerStrokes).toHaveBeenCalledTimes(2);
    });
  });
});
