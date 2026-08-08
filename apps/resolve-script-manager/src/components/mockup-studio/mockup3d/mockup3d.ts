/**
 * mockup3d.ts — ekte 3D device-render (Three.js), bakt til et 2D-canvas.
 *
 * Én GJENBRUKT WebGLRenderer + scene + kamera (ikke ny kontekst per bake — dyrt
 * + WebGL-kontekst-grense). Parametrisk geometri (avrundet slab-kropp + skjerm-
 * plan m/ skjermbilde-tekstur). Returnerer et 2D-canvas som rasterisatoren
 * drawImage-er inn i device-boksen → WYSIWYG + alle eksporter.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { deviceDims, type Device3DVariant } from './deviceGeometry';

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function ensure(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
  if (!renderer || !scene || !camera) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    camera.position.set(0, 0, 5.2); // strammet så telefonen (høyde ~2.06) fyller ~85% + margin for tilt
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 4, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.8); fill.position.set(-4, 1, 3); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6); rim.position.set(0, -3, -4); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  }
  return { renderer, scene, camera };
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('img')); im.src = src; });
}

async function buildDevice(variant: Device3DVariant, shot?: string): Promise<THREE.Group> {
  const d = deviceDims(variant);
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(d.bodyW, d.bodyH, d.bodyD, 4, d.cornerR * d.bodyW),
    new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.85, roughness: 0.38 }),
  );
  g.add(body);
  const sw = d.bodyW - d.screenInset * 2, sh = d.bodyH - d.screenInset * 2;
  // Skjermen er SELV-LYST (unlit) → skjermbildet vises i sanne farger uansett
  // lys, ingen spekulær utblåsing. Glass-refleks kan legges til som eget lag senere.
  let mat: THREE.Material = new THREE.MeshBasicMaterial({ color: 0x000000 });
  if (shot) {
    try {
      const img = await loadImg(shot);
      const tex = new THREE.CanvasTexture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.MeshBasicMaterial({ map: tex });
    } catch { /* svart skjerm */ }
  }
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
  screen.position.z = d.bodyD / 2 + 0.002;
  g.add(screen);
  return g;
}

export async function render3dDevice(opts: { variant: Device3DVariant; shot?: string; rotX: number; rotY: number; rotZ: number; light?: string; w: number; h: number }): Promise<HTMLCanvasElement> {
  const { renderer: r, scene: s, camera: c } = ensure();
  r.setSize(opts.w, opts.h, false);
  c.aspect = opts.w / opts.h; c.updateProjectionMatrix();
  const prev = s.getObjectByName('device');
  if (prev) { s.remove(prev); }
  const dev = await buildDevice(opts.variant, opts.shot);
  dev.name = 'device';
  dev.rotation.set(THREE.MathUtils.degToRad(opts.rotX), THREE.MathUtils.degToRad(opts.rotY), THREE.MathUtils.degToRad(opts.rotZ));
  s.add(dev);
  r.render(s, c);
  const out = document.createElement('canvas');
  out.width = opts.w; out.height = opts.h;
  const octx = out.getContext('2d');
  if (octx) octx.drawImage(r.domElement, 0, 0);
  return out;
}

export function dispose3d(): void {
  renderer?.dispose();
  renderer = null; scene = null; camera = null;
}
