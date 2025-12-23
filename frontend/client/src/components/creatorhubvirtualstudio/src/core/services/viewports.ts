let r3fCanvas: HTMLCanvasElement | null = null;
let activeCameraId: string | null = null;
let histogramCanvas: HTMLCanvasElement | null = null;
let depthCanvas: HTMLCanvasElement | null = null;
let threeScene: any = null;
let mainCamera: any = null;
let dragGhostPos: [number, number, number] | null = null;
let dragGhostAsset: any | null = null;
type OverlayMode = 'none' | 'zebra' | 'falsecolor' | 'peaking';
let overlayMode: OverlayMode ='none';

export function setR3FCanvas(el: HTMLCanvasElement | null) {
  r3fCanvas = el;
}
export function getR3FCanvas(): HTMLCanvasElement | null {
  return r3fCanvas;
}

export function setActiveCameraId(id: string | null) {
  activeCameraId = id;
}
export function getActiveCameraId(): string | null {
  return activeCameraId;
}

export function setHistogramCanvas(el: HTMLCanvasElement | null) {
  histogramCanvas = el;
}
export function getHistogramCanvas(): HTMLCanvasElement | null {
  return histogramCanvas;
}
export function setDepthCanvas(el: HTMLCanvasElement | null) {
  depthCanvas = el;
}
export function getDepthCanvas(): HTMLCanvasElement | null {
  return depthCanvas;
}

export function setThreeScene(scene: any) {
  threeScene = scene;
}
export function getThreeScene(): any {
  return threeScene;
}

export function setOverlayMode(mode: OverlayMode) {
  overlayMode = mode;
}
export function getOverlayMode(): OverlayMode {
  return overlayMode;
}

export function setMainCamera(cam: any) {
  mainCamera = cam;
}
export function getMainCamera(): any {
  return mainCamera;
}

export function setDragGhost(pos: [number, number, number] | null) {
  dragGhostPos = pos;
}
export function setDragGhostPayload(payload: { pos: [number, number, number]; asset: any } | null) {
  dragGhostPos = payload?.pos || null;
  dragGhostAsset = payload?.asset || null;
}
export function getDragGhost(): [number, number, number] | null {
  return dragGhostPos;
}

export function getDragGhostAsset(): any | null {
  return dragGhostAsset;
}
