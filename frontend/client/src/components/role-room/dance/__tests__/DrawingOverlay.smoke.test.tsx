// @ts-nocheck
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeAll } from 'vitest';

// jsdom-shim: ResizeObserver brukes av komponenten for å trigge redraw
// når wrapper-størrelsen endrer seg.
beforeAll(() => {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  // jsdom har ikke canvas — mock 2D context med no-op-stubs så redraw()
  // ikke kaster. Stubsene returnerer void; vi tester onPathsChange-output,
  // ikke pixel-rendering.
  HTMLCanvasElement.prototype.getContext = function () {
    return {
      scale: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      set lineCap(_: string) {},
      set lineJoin(_: string) {},
      set strokeStyle(_: string) {},
      set lineWidth(_: number) {},
    } as unknown as CanvasRenderingContext2D;
  } as typeof HTMLCanvasElement.prototype.getContext;
  // setPointerCapture / hasPointerCapture er heller ikke i jsdom.
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = function () {};
  }
});

import { DrawingOverlay, type DrawingPath } from '../DrawingOverlay';

function getCanvas(): HTMLCanvasElement {
  return screen.getByTestId('drawing-overlay-canvas') as HTMLCanvasElement;
}

function dispatchPointer(canvas: HTMLCanvasElement, type: string, x: number, y: number) {
  const ev = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerType: 'mouse',
    pointerId: 1,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: type === 'pointerdown' || type === 'pointermove' ? 1 : 0,
  });
  canvas.dispatchEvent(ev);
}

function dispatchMouse(canvas: HTMLCanvasElement, type: string, x: number, y: number) {
  const ev = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: type === 'mousedown' || type === 'mousemove' ? 1 : 0,
  });
  canvas.dispatchEvent(ev);
}

// jsdom mangler getBoundingClientRect-presisjon; mocker så normaliserte
// koordinater blir deterministiske.
function mockCanvasRect(canvas: HTMLCanvasElement, width = 100, height = 100) {
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe('Sprint A.7 — DrawingOverlay event-handling', () => {
  it('mouse-only events (Playwright e2e) registrerer en stroke', () => {
    const onPathsChange = vi.fn();
    render(
      <DrawingOverlay
        paths={[]}
        onPathsChange={onPathsChange}
        enabled
      />,
    );
    const canvas = getCanvas();
    mockCanvasRect(canvas);

    dispatchMouse(canvas, 'mousedown', 10, 10);
    dispatchMouse(canvas, 'mousemove', 50, 50);
    dispatchMouse(canvas, 'mouseup', 50, 50);

    expect(onPathsChange).toHaveBeenCalledTimes(1);
    const [paths] = onPathsChange.mock.calls[0];
    expect(paths).toHaveLength(1);
    expect(paths[0].points).toHaveLength(2);
    expect(paths[0].points[0]).toMatchObject({ x: 0.1, y: 0.1 });
    expect(paths[0].points[1]).toMatchObject({ x: 0.5, y: 0.5 });
  });

  it('pointer-only events (touch/stylus) registrerer en stroke', () => {
    const onPathsChange = vi.fn();
    render(
      <DrawingOverlay
        paths={[]}
        onPathsChange={onPathsChange}
        enabled
      />,
    );
    const canvas = getCanvas();
    mockCanvasRect(canvas);

    dispatchPointer(canvas, 'pointerdown', 20, 20);
    dispatchPointer(canvas, 'pointermove', 60, 60);
    dispatchPointer(canvas, 'pointerup', 60, 60);

    expect(onPathsChange).toHaveBeenCalledTimes(1);
    const [paths] = onPathsChange.mock.calls[0];
    expect(paths[0].points).toHaveLength(2);
  });

  it('både pointer + mouse-events (ekte browser) dupliserer ikke punkter', () => {
    const onPathsChange = vi.fn();
    render(
      <DrawingOverlay
        paths={[]}
        onPathsChange={onPathsChange}
        enabled
      />,
    );
    const canvas = getCanvas();
    mockCanvasRect(canvas);

    // Browser fyrer pointer FØR mouse for samme bevegelse. mousedown
    // skal hoppes over fordi pointer-stroke allerede er aktiv. Mousemoves
    // og mouseup skal også ignoreres så vi ikke dupliserer punkter.
    dispatchPointer(canvas, 'pointerdown', 10, 10);
    dispatchMouse(canvas, 'mousedown', 10, 10);
    dispatchPointer(canvas, 'pointermove', 30, 30);
    dispatchMouse(canvas, 'mousemove', 30, 30);
    dispatchPointer(canvas, 'pointermove', 50, 50);
    dispatchMouse(canvas, 'mousemove', 50, 50);
    dispatchPointer(canvas, 'pointerup', 50, 50);
    dispatchMouse(canvas, 'mouseup', 50, 50);

    expect(onPathsChange).toHaveBeenCalledTimes(1);
    const [paths] = onPathsChange.mock.calls[0];
    // 1 startpunkt + 2 movepunkter = 3. Ikke 6 (=3×2 fra dobbel-fyring).
    expect(paths[0].points).toHaveLength(3);
  });

  it('readOnly=true blokkerer all input', () => {
    const onPathsChange = vi.fn();
    render(
      <DrawingOverlay
        paths={[{ tool: 'pen', color: '#fff', width: 2, points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }] }]}
        onPathsChange={onPathsChange}
        enabled={false}
        readOnly
      />,
    );
    const canvas = getCanvas();
    mockCanvasRect(canvas);

    dispatchPointer(canvas, 'pointerdown', 10, 10);
    dispatchPointer(canvas, 'pointermove', 50, 50);
    dispatchPointer(canvas, 'pointerup', 50, 50);
    dispatchMouse(canvas, 'mousedown', 10, 10);

    expect(onPathsChange).not.toHaveBeenCalled();
  });

  it('enabled=false blokkerer ny tegning men beholder paths-prop', () => {
    const onPathsChange = vi.fn();
    const existing: DrawingPath[] = [
      { tool: 'pen', color: '#fbbf24', width: 3, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    ];
    render(
      <DrawingOverlay
        paths={existing}
        onPathsChange={onPathsChange}
        enabled={false}
      />,
    );
    const canvas = getCanvas();
    mockCanvasRect(canvas);

    dispatchMouse(canvas, 'mousedown', 10, 10);
    dispatchMouse(canvas, 'mousemove', 50, 50);
    dispatchMouse(canvas, 'mouseup', 50, 50);

    expect(onPathsChange).not.toHaveBeenCalled();
  });

  it('kort stroke (kun ett punkt) forkastes', () => {
    const onPathsChange = vi.fn();
    render(
      <DrawingOverlay
        paths={[]}
        onPathsChange={onPathsChange}
        enabled
      />,
    );
    const canvas = getCanvas();
    mockCanvasRect(canvas);

    dispatchMouse(canvas, 'mousedown', 10, 10);
    dispatchMouse(canvas, 'mouseup', 10, 10);

    expect(onPathsChange).not.toHaveBeenCalled();
  });
});
